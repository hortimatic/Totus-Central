<?php
namespace TotusCentralConnector;

/** Native paid sale. Called only inside NativeEffectHandler's SQL transaction.
 * The quote reader returns a completed, server-owned cart.quote operation;
 * prices, payment-module names and state IDs never come from the browser.
 */
final class NativeSale
{
    private $quoteReader;
    private $ownerReader;
    private $module;
    private array $profile;

    public function __construct(callable $quoteReader, callable $ownerReader, $module, array $profile)
    {
        Protocol::ensure($module instanceof \PaymentModule, 'PAYMENT_MODULE_REQUIRED');
        foreach (['preparing_state_id','paid_state_id'] as $key) {
            Protocol::ensure(is_int($profile[$key] ?? null) && $profile[$key] > 0, 'SALE_PROFILE_INVALID');
        }
        Protocol::ensure(is_array($profile['payment_labels'] ?? null), 'SALE_PROFILE_INVALID');
        $labels=$profile['payment_labels'];
        Protocol::ensure(count($labels)>0 && count(array_unique($labels))===count($labels), 'SALE_PROFILE_INVALID');
        foreach ($labels as $method=>$label) {
            Protocol::ensure(in_array($method,['cash','card','bizum','transfer'],true) && is_string($label) &&
                strlen($label)>0 && strlen($label)<=70 && !preg_match('/[\x00-\x1f]/',$label), 'SALE_PROFILE_INVALID');
        }
        $this->quoteReader=$quoteReader;$this->ownerReader=$ownerReader;
        $this->module=$module;$this->profile=$profile;
    }

    private function intent(array $command): array
    {
        $payload=$command['payload'] ?? [];
        Protocol::ensure(($command['command'] ?? null)==='sale.commit' &&
            array_diff(array_keys($payload),['cart_id','quote_operation_id','quote_fingerprint','payments','allow_out_of_stock'])===[] &&
            count($payload)===(array_key_exists('allow_out_of_stock',$payload)?5:4) && (!array_key_exists('allow_out_of_stock',$payload)||is_bool($payload['allow_out_of_stock'])) && is_int($payload['cart_id']??null) && $payload['cart_id']>0 &&
            Protocol::uuid($payload['quote_operation_id']??null) &&
            is_string($payload['quote_fingerprint']??null) && preg_match('/^[a-f0-9]{64}$/D',$payload['quote_fingerprint']) &&
            is_array($payload['payments']??null) && array_is_list($payload['payments']) &&
            count($payload['payments'])>=1 && count($payload['payments'])<=4,'SALE_INTENT_INVALID');
        $owner=($this->ownerReader)($payload['cart_id'],$command);
        Protocol::ensure(is_array($owner) && ($owner['verified']??false)===true,'CART_OWNERSHIP_REQUIRED');
        $saved=($this->quoteReader)($payload['quote_operation_id'],$command);
        Protocol::ensure(is_array($saved) && ($saved['verified']??false)===true &&
            ($saved['quote']['cart_id']??null)===$payload['cart_id'] &&
            ($saved['quote']['shop_id']??null)===$command['shop_id'] &&
            hash_equals($saved['quote_fingerprint']??'',$payload['quote_fingerprint']), 'SALE_QUOTE_MISMATCH');
        $quote=$saved['quote'];$allocated=0;$seen=[];
        foreach ($payload['payments'] as $payment) {
            Protocol::ensure(is_array($payment) &&
                array_diff(array_keys($payment),['method','amount_cents','received_cents'])===[] &&
                isset($this->profile['payment_labels'][$payment['method']??'']) &&
                !isset($seen[$payment['method']]) && is_int($payment['amount_cents']??null) &&
                $payment['amount_cents']>0 && $payment['amount_cents']<=100000000000,'SALE_PAYMENT_INVALID');
            if ($payment['method']==='cash') {
                Protocol::ensure(is_int($payment['received_cents']??null) &&
                    $payment['received_cents']>=$payment['amount_cents'] &&
                    $payment['received_cents']<=100000000000,'SALE_CASH_INSUFFICIENT');
            } else {
                Protocol::ensure(!array_key_exists('received_cents',$payment),'SALE_CARD_CHANGE_FORBIDDEN');
            }
            $allocated+=$payment['amount_cents'];$seen[$payment['method']]=true;
        }
        Protocol::ensure($allocated===($quote['total_cents']??null),'SALE_PAYMENT_TOTAL_MISMATCH');
        return [$payload,$saved,$owner];
    }

    private static function allowsShortage(array $payload,array $line,array $owner): bool
    {return ($payload['allow_out_of_stock']??false)===true&&($line['allow_out_of_stock']??false)===true&&
        ($owner['allow_out_of_stock']??false)===true;}

    public function execute(array $command): array
    {
        [$payload,$saved,$owner]=$this->intent($command);
        Protocol::ensure(is_int($saved['quoted_at']??null) && $saved['quoted_at']<=time()*1000+1000 &&
            $saved['quoted_at']>=time()*1000-120000,'SALE_QUOTE_EXPIRED');
        $cart=new \Cart($payload['cart_id']);
        Protocol::ensure(\Validate::isLoadedObject($cart) && !$cart->orderExists() &&
            (int)$cart->id_shop===$command['shop_id'] &&
            (int)$cart->id_customer===($owner['customer_id']??null),'SALE_CART_CHANGED');
        $preparing=new \OrderState($this->profile['preparing_state_id']);
        $paid=new \OrderState($this->profile['paid_state_id']);
        Protocol::ensure(\Validate::isLoadedObject($preparing) && !$preparing->logable && !$preparing->paid &&
            !$preparing->invoice && !$preparing->send_email && \Validate::isLoadedObject($paid) &&
            $paid->paid && $paid->logable && $paid->invoice && $paid->delivery && $paid->shipped && !$paid->send_email,
            'SALE_NATIVE_STATES_INVALID');
        $context=\Context::getContext();$previous=get_object_vars($context);
        $previousShop=\Shop::getContextShopID();$previousType=\Shop::getContext();
        try {
            $context->shop=new \Shop($command['shop_id']);\Shop::setContext(\Shop::CONTEXT_SHOP,$command['shop_id']);
            $context->cart=$cart;$context->customer=new \Customer((int)$cart->id_customer);
            $context->currency=new \Currency((int)$cart->id_currency);
            $context->language=new \Language((int)$cart->id_lang);
            $address=new \Address((int)$cart->id_address_delivery);
            $context->country=new \Country((int)$address->id_country);
            $db=\Db::getInstance()->getLink();
            Protocol::ensure($db instanceof \PDO && $db->inTransaction(),'SALE_TRANSACTION_REQUIRED');
            $locks=$saved['quote']['lines'];usort($locks,static fn($a,$b)=>[$a['product_id'],$a['attribute_id']]<=>[$b['product_id'],$b['attribute_id']]);
            foreach($locks as $line){
                $id=(int)\StockAvailable::getStockAvailableIdByProductId($line['product_id'],$line['attribute_id'],$command['shop_id']);
                $lock=$db->prepare('SELECT quantity,id_shop,depends_on_stock FROM `'._DB_PREFIX_.'stock_available` WHERE id_stock_available=? FOR UPDATE');
                $lock->execute([$id]);$stock=$lock->fetch(\PDO::FETCH_ASSOC);
                Protocol::ensure($stock && (int)$stock['id_shop']===$command['shop_id'] &&
                    !(bool)$stock['depends_on_stock'] && ((int)$stock['quantity']>=$line['quantity']||self::allowsShortage($payload,$line,$owner)&&(int)$stock['quantity']-$line['quantity']>=-2147483648),'SALE_STOCK_SCOPE_OR_QUANTITY');
            }
            \Cache::clean('*');
            $cart->getProducts(true);$cart->getPackageList(true);$cart->getDeliveryOptionList($context->country,true);
            // Recompute with the same native engine immediately before validation.
            $manager=new \PrestaShop\PrestaShop\Adapter\ContextStateManager(new \PrestaShop\PrestaShop\Adapter\LegacyContext());
            $quoter=new NativeCartQuote($this->ownerReader,$manager);
            $fresh=$quoter->execute(array_replace($command,['command'=>'cart.quote','payload'=>['cart_id'=>(int)$cart->id]]));
            Protocol::ensure(hash_equals($saved['quote_fingerprint'],$fresh['quote_fingerprint']),'SALE_QUOTE_CHANGED');
            $before=[];
            foreach ($fresh['quote']['lines'] as $line) {
                $product=new \Product($line['product_id'],false,(int)$cart->id_lang,(int)$cart->id_shop);
                Protocol::ensure(\Validate::isLoadedObject($product) && $product->active && $product->available_for_order &&
                    !$product->is_virtual && !\Pack::isPack((int)$product->id),'SALE_PRODUCT_UNSUPPORTED');
                $quantity=(int)\StockAvailable::getQuantityAvailableByProduct($line['product_id'],$line['attribute_id'],$command['shop_id']);
                Protocol::ensure($quantity>=$line['quantity']||self::allowsShortage($payload,$line,$owner)&&$quantity-$line['quantity']>=-2147483648,'SALE_STOCK_INSUFFICIENT');
                $before[$line['product_id'].':'.$line['attribute_id']]=$quantity;
            }
            $label=count($payload['payments'])>1?'Mixto':$this->profile['payment_labels'][$payload['payments'][0]['method']];
            $this->module->validateOrder((int)$cart->id,(int)$preparing->id,$saved['quote']['total_cents']/100,
                $label,null,[],(int)$cart->id_currency,false,$cart->secure_key,$context->shop);
            $order=new \Order((int)$this->module->currentOrder);
            Protocol::ensure(\Validate::isLoadedObject($order) && (int)$order->id_cart===(int)$cart->id &&
                count($order->getOrderPaymentCollection())===0,'SALE_INITIAL_ORDER_INVALID');
            foreach ($payload['payments'] as $payment) {
                $method=$this->profile['payment_labels'][$payment['method']];
                Protocol::ensure($order->addOrderPayment($payment['amount_cents']/100,$method,
                    'TOTUS-'.$command['operation_id'].'-'.$payment['method'],$context->currency),'SALE_NATIVE_PAYMENT_FAILED');
            }
            NativePaidPickup::complete($order,$preparing,$paid);
            foreach ($fresh['quote']['lines'] as $line) {
                $after=(int)\StockAvailable::getQuantityAvailableByProduct($line['product_id'],$line['attribute_id'],$command['shop_id']);
                Protocol::ensure($after===$before[$line['product_id'].':'.$line['attribute_id']]-$line['quantity'],'SALE_STOCK_READBACK_FAILED');
                // OrderDetail already deducted quantity. Record its physical
                // pickup through native ObjectModel on this PDO, with no second
                // quantity update or separate Doctrine transaction.
                $stockId=(int)\StockAvailable::getStockAvailableIdByProductId($line['product_id'],$line['attribute_id'],$command['shop_id']);
                $s=$db->prepare('SELECT COUNT(*) FROM `'._DB_PREFIX_.'stock_mvt` WHERE id_order=? AND id_stock=? AND sign=-1');
                $s->execute([(int)$order->id,$stockId]);
                if((int)$s->fetchColumn()===0){
                    $movement=new \StockMvt();$movement->id_stock=$stockId;$movement->id_order=(int)$order->id;$movement->id_employee=0;
                    $movement->employee_firstname='Totus';$movement->employee_lastname='Central';
                    $movement->physical_quantity=$line['quantity'];$movement->sign=-1;
                    $movement->id_stock_mvt_reason=(int)\Configuration::get('PS_STOCK_CUSTOMER_ORDER_REASON');
                    $movement->price_te=0;$movement->date_add=date('Y-m-d H:i:s');
                    Protocol::ensure($movement->add(),'SALE_STOCK_MOVEMENT_FAILED');
                }
                (new \PrestaShop\PrestaShop\Adapter\StockManager())->updatePhysicalProductQuantity($command['shop_id'],
                    (int)\Configuration::get('PS_OS_ERROR'),(int)\Configuration::get('PS_OS_CANCELED'),$line['product_id']);
            }
            return $this->readback($command,$payload,$saved,(int)$order->id);
        } finally {
            foreach (['shop','cart','customer','currency','language','country'] as $key) $context->$key=$previous[$key]??null;
            \Shop::setContext($previousType,$previousShop);
        }
    }

    private function readback(array $command,array $payload,array $saved,int $orderId): array
    {
        $order=new \Order($orderId);$quote=$saved['quote'];
        Protocol::ensure(\Validate::isLoadedObject($order) && (int)$order->id_cart===$payload['cart_id'] &&
            (int)$order->id_shop===$command['shop_id'] && (int)$order->id_customer===$quote['customer_id'] &&
            (int)$order->id_currency===$quote['currency_id'] && (int)$order->id_address_invoice===$quote['invoice_address_id'] &&
            (int)$order->id_address_delivery===$quote['delivery_address_id'] && (int)$order->id_carrier===$quote['carrier_id'] &&
            (int)$order->id_lang===$quote['language_id'] && $order->module===$this->module->name &&
            self::cents($order->total_paid_tax_incl)===$quote['total_cents'],'SALE_ORDER_READBACK_FAILED');
        $details=$order->getOrderDetailList();$expected=[];$observed=[];
        foreach ($quote['lines'] as $line)$expected[$line['product_id'].':'.$line['attribute_id']]=$line['quantity'];
        foreach ($details as $line) {
            $key=(int)$line['product_id'].':'.(int)$line['product_attribute_id'];
            Protocol::ensure(!isset($observed[$key]),'SALE_ORDER_LINES_AMBIGUOUS');$observed[$key]=(int)$line['product_quantity'];
            $quoted=null;foreach($quote['lines'] as $candidate)if($candidate['product_id']===(int)$line['product_id']&&
                $candidate['attribute_id']===(int)$line['product_attribute_id']){$quoted=$candidate;break;}
            Protocol::ensure($quoted!==null&&
                number_format((float)$line['unit_price_tax_incl'],6,'.','')===number_format((float)$quoted['unit_tax_incl'],6,'.','')&&
                number_format((float)$line['unit_price_tax_excl'],6,'.','')===number_format((float)$quoted['unit_tax_excl'],6,'.','')&&
                self::cents($line['total_price_tax_incl'])===self::cents($quoted['line_tax_incl'])&&
                self::cents($line['total_price_tax_excl'])===self::cents($quoted['line_tax_excl']),'SALE_LINE_PRICE_READBACK_FAILED');
        }
        ksort($expected);ksort($observed);Protocol::ensure($expected===$observed,'SALE_LINES_READBACK_FAILED');
        $payments=[];$paymentEvidence=[];$currency=new \Currency((int)$quote['currency_id']);
        foreach ($order->getOrderPaymentCollection() as $payment) {
            $key=array_search($payment->payment_method,$this->profile['payment_labels'],true);
            Protocol::ensure(is_string($key) && !isset($payments[$key]) &&
                (int)$payment->id_currency===$quote['currency_id'] &&
                $payment->transaction_id==='TOTUS-'.$command['operation_id'].'-'.$key,'SALE_PAYMENT_READBACK_FAILED');
            $payments[$key]=self::cents($payment->amount);
            $paymentEvidence[]=['id'=>(int)$payment->id,'amountCents'=>self::cents($payment->amount),
                'methodLabel'=>(string)$payment->payment_method,'currency'=>(string)$currency->iso_code,'recordVerified'=>true];
        }
        $allocated=[];foreach ($payload['payments'] as $payment)$allocated[$payment['method']]=$payment['amount_cents'];
        ksort($payments);ksort($allocated);Protocol::ensure($payments===$allocated,'SALE_PAYMENT_READBACK_FAILED');
        Protocol::ensure(count($order->getHistory((int)$quote['language_id'],$this->profile['paid_state_id']))>=1 &&
            count($order->getInvoicesCollection())===1,'SALE_DOCUMENT_READBACK_FAILED');
        Protocol::ensure(self::cents($order->total_products_wt)===self::cents($quote['products_tax_incl'])&&
            self::cents($order->total_products)===self::cents($quote['products_tax_excl'])&&
            self::cents($order->total_shipping_tax_incl)===self::cents($quote['shipping_tax_incl'])&&
            self::cents($order->total_discounts_tax_incl)===self::cents($quote['discounts_tax_incl']),'SALE_TOTAL_COMPONENTS_READBACK_FAILED');
        foreach($order->getInvoicesCollection() as $invoice)Protocol::ensure((int)$invoice->id_order===$orderId&&
            self::cents($invoice->total_paid_tax_incl)===$quote['total_cents'],'SALE_INVOICE_AMOUNT_READBACK_FAILED');
        $inventory=[];$db=\Db::getInstance()->getLink();
        foreach($quote['lines'] as $line){
            $stockId=(int)\StockAvailable::getStockAvailableIdByProductId($line['product_id'],$line['attribute_id'],$command['shop_id']);
            $s=$db->prepare('SELECT id_stock_mvt,physical_quantity FROM `'._DB_PREFIX_.'stock_mvt` WHERE id_order=? AND id_stock=? AND sign=-1 ORDER BY id_stock_mvt LIMIT 201');
            $s->execute([$orderId,$stockId]);$movements=$s->fetchAll(\PDO::FETCH_ASSOC);
            Protocol::ensure(count($movements)>0&&count($movements)<=200&&
                array_sum(array_column($movements,'physical_quantity'))===$line['quantity'],'SALE_STOCK_MOVEMENT_READBACK_FAILED');
            $inventory[]=['mode'=>'native-movements','productId'=>$line['product_id'],'attributeId'=>$line['attribute_id'],
                'stockRecordId'=>$stockId,'orderId'=>$orderId,'deductedQty'=>$line['quantity'],
                'movementIds'=>array_map(static fn($row)=>(int)$row['id_stock_mvt'],$movements),
                'recordVerified'=>true,'ambiguous'=>false];
        }
        $state=new \OrderState((int)$order->current_state);$lineEvidence=[];
        foreach($details as $line)$lineEvidence[]=['productId'=>(int)$line['product_id'],'attributeId'=>(int)$line['product_attribute_id'],
            'qty'=>(int)$line['product_quantity'],'unitTaxInclMicros'=>self::micros($line['unit_price_tax_incl']),
            'unitTaxExclMicros'=>self::micros($line['unit_price_tax_excl']),'lineTaxInclCents'=>self::cents($line['total_price_tax_incl']),
            'lineTaxExclCents'=>self::cents($line['total_price_tax_excl'])];
        $evidence=['shopId'=>(int)$order->id_shop,'cartId'=>(int)$order->id_cart,'orderId'=>$orderId,
            'customerId'=>(int)$order->id_customer,'invoiceAddressId'=>(int)$order->id_address_invoice,
            'deliveryAddressId'=>(int)$order->id_address_delivery,'currencyId'=>(int)$order->id_currency,'currency'=>(string)$currency->iso_code,
            'paymentModule'=>(string)$order->module,'stateId'=>(int)$order->current_state,'statePaid'=>(bool)$state->paid,
            'totalCents'=>self::cents($order->total_paid_tax_incl),'receivedCents'=>self::cents($order->total_paid_real),
            'shippingCents'=>self::cents($order->total_shipping_tax_incl),'discountCents'=>self::cents($order->total_discounts_tax_incl),
            'lines'=>$lineEvidence,'payments'=>$paymentEvidence,'inventory'=>$inventory];
        return ['verified'=>true,'native_reference'=>$orderId,'order_id'=>$orderId,'reference'=>(string)$order->reference,
            'cart_id'=>$payload['cart_id'],'total_cents'=>$quote['total_cents'],'payments'=>$payments,'lines'=>$observed,
            'quote_operation_id'=>$payload['quote_operation_id'],'quote_fingerprint'=>$payload['quote_fingerprint'],
            'payment_intent'=>$payload['payments'],'inventory'=>$inventory,'order_evidence'=>$evidence,
            'sale_profile'=>['preparing_state_id'=>$this->profile['preparing_state_id'],
                'paid_state_id'=>$this->profile['paid_state_id'],'payment_labels'=>$this->profile['payment_labels']],
            'invoice_ids'=>array_map(static fn($invoice)=>(int)$invoice->id,iterator_to_array($order->getInvoicesCollection()))];
    }

    public function reconcile(array $command,array $claim): ?array
    {
        [$payload,$saved]=$this->intent($command);
        $orderId=(int)\Order::getIdByCartId($payload['cart_id']);
        return $orderId>0?$this->readback($command,$payload,$saved,$orderId):null;
    }

    private static function cents($value): int
    {
        Protocol::ensure(is_numeric($value) && is_finite((float)$value) && (float)$value>=0,'SALE_NATIVE_AMOUNT_INVALID');
        $decimal=number_format((float)$value,6,'.','');
        Protocol::ensure(substr($decimal,-4)==='0000','SALE_NATIVE_AMOUNT_PRECISION');
        return (int)str_replace('.','',substr($decimal,0,-4));
    }
    private static function micros($value): int
    {Protocol::ensure(is_numeric($value)&&is_finite((float)$value)&&(float)$value>=0,'SALE_NATIVE_AMOUNT_INVALID');
     return (int)str_replace('.','',number_format((float)$value,6,'.',''));}
}
