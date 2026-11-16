<?php
namespace TotusCentralConnector;

/** Credit notes and selective restocking for this integration's own sales.
 * Native tax/refund services are used; no order/payment is recreated, and a
 * cashier's terminal-refund attestation is never called a bank API result.
 */
final class NativeReturns
{
    private \PDO $db;private array $profile;private $module;private $container;
    public function __construct(\PDO $db,$module,array $profile,$container)
    {$this->db=$db;$this->module=$module;$this->profile=$profile;$this->container=$container;}
    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'RETURN_STORE_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (operation_id CHAR(36) NOT NULL PRIMARY KEY,
            sale_operation_id CHAR(36) NOT NULL,installation_id CHAR(36) NOT NULL,
            shop_id BIGINT UNSIGNED NOT NULL,api_account_id BIGINT UNSIGNED NOT NULL,
            actor_id CHAR(36) NOT NULL,order_id BIGINT UNSIGNED NOT NULL,
            result_json MEDIUMTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY sale_returns (sale_operation_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
    private function sale(string $id,array $scope): array
    {
        Protocol::ensure(Protocol::uuid($id),'RETURN_SALE_INVALID');
        $s=$this->db->prepare('SELECT * FROM `'._DB_PREFIX_.'totus_tpv_journal` WHERE request_id=?');$s->execute([$id]);$row=$s->fetch(\PDO::FETCH_ASSOC);
        Protocol::ensure($row && in_array($row['status'],['completed','pending','uncertain'],true) && $row['command']==='sale.commit' &&
            $row['installation_id']===$scope['installation_id'] && (int)$row['shop_id']===$scope['shop_id'] &&
            (int)$row['api_account_id']===$scope['api_account_id'],'RETURN_SALE_SCOPE_INVALID');
        $read=NativeRuntime::readOperation($this->module,$this->profile,$id,$row['actor_id'],$scope['api_account_id']);
        Protocol::ensure(($read['status']??null)==='verified','RETURN_SALE_NOT_VERIFIED');
        $sale=$read['result'];$order=self::nativeOrder((int)$sale['order_id']);
        Protocol::ensure(\Validate::isLoadedObject($order) && (int)$order->id_shop===$scope['shop_id'] &&
            (int)$order->id_cart===$sale['cart_id'] && $order->module===$this->module->name,'RETURN_NATIVE_ORDER_INVALID');
        Protocol::ensure($order->hasBeenDelivered(),'RETURN_NATIVE_DELIVERY_REQUIRED');
        Protocol::ensure($order->hasBeenPaid(),'RETURN_NATIVE_PAYMENT_REQUIRED');
        return [$row,$sale,$order];
    }
    private static function nativeOrder(int $id): \Order
    {
        // This object is used only after verifying our native sale receipt.
        // BO presentation overrides may return false without a controller.
        // Keep the Order type required by native refund services, but resolve
        // delivery/shipping from core history rather than a BO request action.
        return new class($id) extends \Order {
            public function hasBeenDelivered(){return \OrderCore::hasBeenDelivered();}
            public function hasBeenShipped(){return \OrderCore::hasBeenShipped();}
        };
    }
    private static function rounded($value): int
    {Protocol::ensure(is_numeric($value)&&is_finite((float)$value)&&(float)$value>=0,'RETURN_AMOUNT_INVALID');return (int)round(100*\Tools::ps_round((float)$value,2));}
    /** Stable largest-remainder allocation keeps order-level discounts in returns. */
    private static function allocate(int $total,array $weights): array
    {
        $sum=array_sum($weights);Protocol::ensure($sum>0&&$total>=0&&$total<=$sum,'RETURN_ORDER_TOTAL_INVALID');
        $amounts=[];$remainders=[];$used=0;
        foreach($weights as $id=>$weight){Protocol::ensure($weight>=0&&$weight<=1000000000&&$total<=1000000000,'RETURN_AMOUNT_LIMIT');
            $n=$weight*$total;$amounts[$id]=intdiv($n,$sum);$remainders[$id]=$n%$sum;$used+=$amounts[$id];}
        $ids=array_keys($weights);usort($ids,static fn($a,$b)=>($remainders[$b]<=>$remainders[$a])?:($a<=>$b));
        for($i=0;$i<$total-$used;$i++)$amounts[$ids[$i]]++;
        return $amounts;
    }
    public function available(string $saleId,array $scope): array
    {
        [$row,$sale,$order]=$this->sale($saleId,$scope);
        Protocol::ensure(self::rounded($order->total_shipping_tax_incl)===0&&self::rounded($order->total_wrapping_tax_incl)===0,'RETURN_SHIPPING_UNSUPPORTED');
        $details=$order->getOrderDetailList();$weights=[];$priorQty=[];$priorAmounts=[];$usedPayments=[];
        $s=$this->db->prepare('SELECT result_json FROM `'._DB_PREFIX_.'totus_tpv_returns` WHERE sale_operation_id=?');$s->execute([$saleId]);
        foreach($s->fetchAll(\PDO::FETCH_COLUMN) as $json){$r=json_decode($json,true,32,JSON_THROW_ON_ERROR);
            foreach($r['items'] as $item){$id=$item['detail_id'];$priorQty[$id]=($priorQty[$id]??0)+$item['quantity'];$priorAmounts[$id]=($priorAmounts[$id]??0)+$item['amount_cents'];}
            foreach($r['refund_payments'] as $payment)$usedPayments[$payment['method']]=($usedPayments[$payment['method']]??0)+$payment['amount_cents'];
        }
        foreach($details as $line)$weights[(int)$line['id_order_detail']]=self::rounded($line['total_price_tax_incl']);
        $allocated=self::allocate($sale['total_cents'],$weights);$items=[];
        foreach($details as $line){$id=(int)$line['id_order_detail'];$returned=(int)$line['product_quantity_refunded']+(int)$line['product_quantity_return'];
            Protocol::ensure($returned===($priorQty[$id]??0),'RETURN_OUTSIDE_CHANGE_DETECTED');
            $items[]=['detail_id'=>$id,'product_id'=>(int)$line['product_id'],'attribute_id'=>(int)$line['product_attribute_id'],
                'name'=>(string)$line['product_name'],'sold_quantity'=>(int)$line['product_quantity'],'returned_quantity'=>$returned,
                'remaining_quantity'=>(int)$line['product_quantity']-$returned,'allocated_cents'=>$allocated[$id],
                'refunded_cents'=>$priorAmounts[$id]??0];
        }
        $remaining=[];foreach($sale['payments'] as $method=>$amount){$remaining[$method]=$amount-($usedPayments[$method]??0);Protocol::ensure($remaining[$method]>=0,'RETURN_PAYMENT_CAP_INVALID');}
        $snapshot=['sale_operation_id'=>$saleId,'order_id'=>(int)$order->id,'currency_id'=>(int)$order->id_currency,
            'items'=>$items,'remaining_payments'=>$remaining];
        return array_merge($snapshot,['state_fingerprint'=>hash('sha256',Protocol::canonical($snapshot))]);
    }
    public function execute(array $command): array
    {
        $p=$command['payload']??[];
        Protocol::ensure(($command['command']??null)==='return.commit' && count($p)>=5&&count($p)<=6 &&
            array_diff(array_keys($p),['sale_operation_id','state_fingerprint','items','payments','operator_confirmed','reason'])===[] &&
            Protocol::uuid($p['sale_operation_id']??null) && is_string($p['state_fingerprint']??null) &&
            ($p['operator_confirmed']??null)===true && is_array($p['items']??null) && array_is_list($p['items']) &&
            count($p['items'])>0 && count($p['items'])<=200 && is_array($p['payments']??null)&&array_is_list($p['payments']),'RETURN_INTENT_INVALID');
        Protocol::ensure($this->db->inTransaction(),'RETURN_TRANSACTION_REQUIRED');
        Protocol::ensure(!isset($p['reason'])||is_string($p['reason'])&&trim($p['reason'])===$p['reason']&&
            mb_strlen($p['reason'])>0&&mb_strlen($p['reason'])<=500&&!preg_match('/[\x00-\x1f]/',$p['reason']),'RETURN_REASON_INVALID');
        [,$sale,$order]=$this->sale($p['sale_operation_id'],$command);
        $lock=$this->db->prepare('SELECT id_order FROM `'._DB_PREFIX_.'orders` WHERE id_order=? FOR UPDATE');$lock->execute([(int)$order->id]);
        $lock=$this->db->prepare('SELECT id_order_detail FROM `'._DB_PREFIX_.'order_detail` WHERE id_order=? ORDER BY id_order_detail FOR UPDATE');$lock->execute([(int)$order->id]);$lock->fetchAll();
        $available=$this->available($p['sale_operation_id'],$command);
        Protocol::ensure(hash_equals($available['state_fingerprint'],$p['state_fingerprint']),'RETURN_STATE_CHANGED');
        $indexed=[];foreach($available['items'] as $item)$indexed[$item['detail_id']]=$item;
        $items=[];$seen=[];$total=0;
        foreach($p['items'] as $item){
            Protocol::ensure(is_array($item)&&count($item)===3&&is_int($item['detail_id']??null)&&isset($indexed[$item['detail_id']])&&
                !isset($seen[$item['detail_id']])&&is_int($item['quantity']??null)&&$item['quantity']>0&&is_bool($item['restock']??null),'RETURN_LINE_INVALID');
            $id=$item['detail_id'];$line=$indexed[$id];Protocol::ensure($item['quantity']<=$line['remaining_quantity'],'RETURN_QUANTITY_EXCEEDED');$seen[$id]=true;
            $cumulative=intdiv($line['allocated_cents']*($line['returned_quantity']+$item['quantity'])*2+$line['sold_quantity'],$line['sold_quantity']*2);
            $amount=$cumulative-$line['refunded_cents'];Protocol::ensure($amount>=0,'RETURN_AMOUNT_INVALID');
            $items[]=array_merge($item,['amount_cents'=>$amount]);$total+=$amount;
        }
        $refunds=[];$paid=0;
        foreach($p['payments'] as $payment){$method=$payment['method']??null;
            Protocol::ensure(is_array($payment)&&count($payment)===2&&is_string($method)&&isset($available['remaining_payments'][$method])&&
                !isset($refunds[$method])&&is_int($payment['amount_cents']??null)&&$payment['amount_cents']>0&&
                $payment['amount_cents']<=$available['remaining_payments'][$method],'RETURN_PAYMENT_INVALID');
            $refunds[$method]=$payment['amount_cents'];$paid+=$payment['amount_cents'];
        }
        Protocol::ensure($paid===$total,'RETURN_PAYMENT_TOTAL_MISMATCH');
        $context=\Context::getContext();$manager=new \PrestaShop\PrestaShop\Adapter\ContextStateManager(new \PrestaShop\PrestaShop\Adapter\LegacyContext());
        $cart=new \Cart((int)$order->id_cart);$address=new \Address((int)$order->id_address_invoice);
        try{
            $manager->saveCurrentContext()->setShop(new \Shop((int)$order->id_shop))->setCart($cart)
                ->setCustomer(new \Customer((int)$order->id_customer))->setCurrency(new \Currency((int)$order->id_currency))
                ->setLanguage(new \Language((int)$order->id_lang))->setCountry(new \Country((int)$address->id_country));
            $beforeSlips=array_column(\OrderSlip::getOrdersSlip((int)$order->id_customer,(int)$order->id),'id_order_slip');$movements=[];
            foreach([false,true] as $restock){$refundDetails=[];$group=[];
                foreach($items as $item){if($item['restock']!==$restock)continue;$detail=new \OrderDetail($item['detail_id']);
                    $taxIncluded=\Group::getPriceDisplayMethod((int)$context->customer->id_default_group)===PS_TAX_INC;
                    $amount=$item['amount_cents']/100;if(!$taxIncluded)$amount=$detail->getTaxCalculator()->removeTaxes($amount);
                    $refundDetails[]=$item['amount_cents']>0?
                        \PrestaShop\PrestaShop\Core\Domain\Order\ValueObject\OrderDetailRefund::createPartialRefund($item['detail_id'],$item['quantity'],number_format($amount,6,'.','')):
                        \PrestaShop\PrestaShop\Core\Domain\Order\ValueObject\OrderDetailRefund::createStandardRefund($item['detail_id'],$item['quantity']);
                    $group[]=$item;
                }
                if(!$group)continue;
                $calculator=$this->container->get('prestashop.adapter.order.refund.order_refund_calculator');
                $summary=$calculator->computeOrderRefund($order,$refundDetails,new \PrestaShop\Decimal\DecimalNumber('0'),
                    \PrestaShop\PrestaShop\Core\Domain\Order\VoucherRefundType::PRODUCT_PRICES_REFUND,null);
                $nativeGross=array_sum(array_column($summary->getProductRefunds(),'total_refunded_tax_incl'));
                Protocol::ensure(self::rounded($nativeGross)===array_sum(array_column($group,'amount_cents')),'RETURN_NATIVE_AMOUNT_CHANGED');
                if($nativeGross>0)$this->container->get('prestashop.adapter.order.refund.order_slip_creator')->create($order,$summary);
                $returnedProducts=(int)\Configuration::get('PS_ORDER_RETURN')===1&&$order->hasBeenDelivered();
                $this->container->get('prestashop.adapter.order.refund.updater')->updateRefundData($summary,$returnedProducts,$restock);
                foreach($group as $item){if(!$restock)continue;$line=$indexed[$item['detail_id']];
                    $stockId=(int)\StockAvailable::getStockAvailableIdByProductId($line['product_id'],$line['attribute_id'],$command['shop_id']);
                    $lock=$this->db->prepare('SELECT quantity,id_shop,depends_on_stock FROM `'._DB_PREFIX_.'stock_available` WHERE id_stock_available=? FOR UPDATE');$lock->execute([$stockId]);$stock=$lock->fetch(\PDO::FETCH_ASSOC);
                    Protocol::ensure($stock&&(int)$stock['id_shop']===$command['shop_id']&&!$stock['depends_on_stock'],'RETURN_STOCK_SCOPE_INVALID');
                    \Cache::clean('*');Protocol::ensure(\StockAvailable::updateQuantity($line['product_id'],$line['attribute_id'],$item['quantity'],$command['shop_id'],false),'RETURN_RESTOCK_FAILED');
                    $mvt=new \StockMvt();$mvt->id_stock=$stockId;$mvt->id_order=(int)$order->id;$mvt->id_employee=0;
                    $mvt->employee_firstname='Totus';$mvt->employee_lastname='Central';$mvt->physical_quantity=$item['quantity'];$mvt->sign=1;
                    $mvt->id_stock_mvt_reason=(int)\Configuration::get('PS_STOCK_CUSTOMER_RETURN_REASON');$mvt->price_te=0;$mvt->date_add=date('Y-m-d H:i:s');
                    Protocol::ensure($mvt->add(),'RETURN_STOCK_MOVEMENT_FAILED');$movements[]=(int)$mvt->id;
                    (new \PrestaShop\PrestaShop\Adapter\StockManager())->updatePhysicalProductQuantity($command['shop_id'],(int)\Configuration::get('PS_OS_ERROR'),(int)\Configuration::get('PS_OS_CANCELED'),$line['product_id']);
                    \Cache::clean('*');Protocol::ensure((int)\StockAvailable::getQuantityAvailableByProduct($line['product_id'],$line['attribute_id'],$command['shop_id'])===(int)$stock['quantity']+$item['quantity'],'RETURN_STOCK_READBACK_FAILED');
                }
            }
            $slips=\OrderSlip::getOrdersSlip((int)$order->id_customer,(int)$order->id);$ids=[];$observed=0;
            foreach($slips as $slip){if(in_array($slip['id_order_slip'],$beforeSlips))continue;$ids[]=(int)$slip['id_order_slip'];$native=new \OrderSlip((int)$slip['id_order_slip']);$observed+=self::rounded($native->total_products_tax_incl);}
            Protocol::ensure($observed===$total && ($total===0||count($ids)>0),'RETURN_DOCUMENT_READBACK_FAILED');
            $result=['verified'=>true,'native_reference'=>$command['operation_id'],'order_id'=>(int)$order->id,
                'sale_operation_id'=>$p['sale_operation_id'],'total_cents'=>$total,'items'=>$items,
                'refund_payments'=>$p['payments'],'credit_note_ids'=>$ids,'stock_movement_ids'=>$movements,
                'external_refund_attested'=>true,'bank_api_executed'=>false,'email_sent'=>false,...(isset($p['reason'])?['reason'=>$p['reason']]:[])];
            $s=$this->db->prepare('INSERT INTO `'._DB_PREFIX_.'totus_tpv_returns` (operation_id,sale_operation_id,installation_id,shop_id,api_account_id,actor_id,order_id,result_json) VALUES (?,?,?,?,?,?,?,?)');
            $s->execute([$command['operation_id'],$p['sale_operation_id'],$command['installation_id'],$command['shop_id'],$command['api_account_id'],$command['actor_id'],(int)$order->id,Protocol::canonical($result)]);
            return $result;
        } finally {$manager->restorePreviousContext();}
    }
    public function reconcile(array $command,array $claim): ?array
    {
        $s=$this->db->prepare('SELECT * FROM `'._DB_PREFIX_.'totus_tpv_returns` WHERE operation_id=?');$s->execute([$command['operation_id']]);$row=$s->fetch(\PDO::FETCH_ASSOC);if(!$row)return null;
        Protocol::ensure($row['installation_id']===$command['installation_id']&&(int)$row['shop_id']===$command['shop_id']&&
            (int)$row['api_account_id']===$command['api_account_id']&&$row['actor_id']===$command['actor_id'],'RETURN_SCOPE_MISMATCH');
        $r=json_decode($row['result_json'],true,32,JSON_THROW_ON_ERROR);$amount=0;
        foreach($r['credit_note_ids'] as $id){$slip=new \OrderSlip($id);Protocol::ensure(\Validate::isLoadedObject($slip)&&(int)$slip->id_order===$r['order_id'],'RETURN_DOCUMENT_MISSING');$amount+=self::rounded($slip->total_products_tax_incl);}
        Protocol::ensure($amount===$r['total_cents'],'RETURN_DOCUMENT_READBACK_FAILED');
        $restocked=array_values(array_filter($r['items'],static fn($item)=>$item['restock']===true));
        Protocol::ensure(count($restocked)===count($r['stock_movement_ids']),'RETURN_MOVEMENT_MISSING');
        foreach($r['stock_movement_ids'] as $index=>$id){$movement=new \StockMvt($id);$item=$restocked[$index];$detail=new \OrderDetail($item['detail_id']);
            $stockId=(int)\StockAvailable::getStockAvailableIdByProductId((int)$detail->product_id,(int)$detail->product_attribute_id,$command['shop_id']);
            Protocol::ensure(\Validate::isLoadedObject($movement)&&\Validate::isLoadedObject($detail)&&
                (int)$detail->id_order===$r['order_id']&&(int)$movement->id_order===$r['order_id']&&(int)$movement->sign===1&&
                (int)$movement->id_stock===$stockId&&(int)$movement->physical_quantity===$item['quantity'],'RETURN_MOVEMENT_MISSING');}
        $this->available($row['sale_operation_id'],$command);
        return $r;
    }
}
