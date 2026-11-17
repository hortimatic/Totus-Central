<?php
namespace TotusCentralConnector;

/** Native 8.2.8 calculation, only for a cart durably owned by this integration.
 * Prepared source, not an installed endpoint. The normal cart calculation can
 * attach automatic cart rules, so this must never accept an arbitrary web cart.
 * No catalogue price or stock writes, order creation, payment or refund here.
 */
final class NativeCartQuote
{
    public static function supportsLineNames(): bool{return true;}
    public static function supportsCommercialQuotes(): bool{return true;}
    private $ownerLookup;
    private $contextManager;
    private $cartLoader;

    public function __construct(callable $ownerLookup, $contextManager, ?callable $cartLoader = null)
    {
        foreach (['setShop','setCart','setCustomer','setCurrency','setLanguage','setCountry','restorePreviousContext'] as $method) {
            Protocol::ensure(is_callable([$contextManager,$method]),'NATIVE_CONTEXT_REQUIRED');
        }
        $this->ownerLookup=$ownerLookup;
        $this->contextManager=$contextManager;
        $this->cartLoader=$cartLoader ?? static fn(int $id)=>new \Cart($id);
    }

    public function execute(array $command): array
    {
        $payload=$command['payload'] ?? [];
        Protocol::ensure(($command['command'] ?? null)==='cart.quote' && array_keys($payload)===['cart_id'] &&
            is_int($payload['cart_id']) && $payload['cart_id']>0,'CART_QUOTE_INVALID');
        $cartId=$payload['cart_id'];
        $owner=($this->ownerLookup)($cartId,$command);
        Protocol::ensure(is_array($owner) && ($owner['verified'] ?? false)===true &&
            ($owner['cart_id'] ?? null)===$cartId && ($owner['shop_id'] ?? null)===$command['shop_id'] &&
            ($owner['installation_id'] ?? null)===$command['installation_id'] &&
            ($owner['api_account_id'] ?? null)===$command['api_account_id'],'CART_OWNERSHIP_REQUIRED');
        $cart=($this->cartLoader)($cartId);
        Protocol::ensure($cart instanceof \Cart && (int)$cart->id===$cartId &&
            (int)$cart->id_shop===$command['shop_id'] && (int)$cart->id_customer>0 &&
            (int)$cart->id_address_invoice>0 && (int)$cart->id_address_delivery>0 &&
            (int)$cart->id_currency>0 && (int)$cart->id_lang>0 && (int)$cart->id_carrier>0,'CART_SCOPE_INVALID');
        Protocol::ensure(!(bool)$cart->gift&&!(bool)$cart->recyclable&&!(bool)$cart->allow_seperated_package,'CART_OPTIONS_UNSUPPORTED');
        Protocol::ensure((int)$cart->id_customer===(int)($owner['customer_id'] ?? 0) &&
            !$cart->orderExists(),'CART_ALREADY_ORDERED_OR_CHANGED');
        $customer=new \Customer((int)$cart->id_customer);
        $invoice=new \Address((int)$cart->id_address_invoice);
        $delivery=new \Address((int)$cart->id_address_delivery);
        $currency=new \Currency((int)$cart->id_currency);
        $language=new \Language((int)$cart->id_lang);
        $shop=new \Shop((int)$cart->id_shop);
        foreach ([$customer,$invoice,$delivery,$currency,$language,$shop] as $entity) {
            Protocol::ensure(\Validate::isLoadedObject($entity),'CART_NATIVE_IDENTITY_MISSING');
        }
        Protocol::ensure((bool)$customer->active && !(bool)$customer->deleted &&
            !(bool)$invoice->deleted && !(bool)$delivery->deleted &&
            (int)$invoice->id_customer===(int)$customer->id && (int)$delivery->id_customer===(int)$customer->id &&
            (bool)$currency->active && !(bool)$currency->deleted && (int)$currency->precision===2 &&
            (bool)$language->active,'CART_NATIVE_IDENTITY_INVALID');
        $taxAddress=\Configuration::get('PS_TAX_ADDRESS_TYPE');
        Protocol::ensure(in_array($taxAddress,['id_address_invoice','id_address_delivery'],true),'TAX_ADDRESS_UNSUPPORTED');
        $country=new \Country((int)($taxAddress==='id_address_invoice'?$invoice->id_country:$delivery->id_country));
        Protocol::ensure(\Validate::isLoadedObject($country),'TAX_COUNTRY_MISSING');
        $manager=$this->contextManager;
        try {
            $manager->setShop($shop);
            $manager->setCart($cart);
            $manager->setCustomer($customer);
            $manager->setCurrency($currency);
            $manager->setLanguage($language);
            $manager->setCountry($country);
            // Trigger native automatic cart rules before taking the line list:
            // a free-gift rule may add a line during native total calculation.
            $cart->getOrderTotal(true,\Cart::BOTH);
            $products=$cart->getProducts(true);
            Protocol::ensure(is_array($products) && count($products)>0 && count($products)<=200,'CART_LINES_INVALID');
            $lines=[];$names=$owner['line_names']??[];
            foreach ($products as $product) {
                Protocol::ensure((int)($product['id_product'] ?? 0)>0 &&
                    (int)($product['cart_quantity'] ?? 0)>0,'CART_LINE_INVALID');
                $key=(int)$product['id_product'].':'.(int)($product['id_product_attribute']??0);$catalogueName=null;
                if((isset($names[$key])||($owner['commercial_only']??false)===true)&&isset($product['name'])&&is_string($product['name'])){$candidate=$product['name'].((isset($product['attributes'])&&$product['attributes']!=null)?' ('.$product['attributes'].')':'');if(preg_match('//u',$candidate)===1&&preg_match_all('/./us',$candidate)<=512&&!preg_match('/[\x00-\x1f\x7f]/u',$candidate))$catalogueName=$candidate;}
                $lines[]=[
                    'product_id'=>(int)$product['id_product'],
                    'attribute_id'=>(int)($product['id_product_attribute'] ?? 0),
                    'quantity'=>(int)$product['cart_quantity'],
                    ...($catalogueName===null?[]:['catalogue_name'=>$catalogueName]),...(isset($names[$key])?['display_name'=>$names[$key]]:[]),
                    'allow_out_of_stock'=>($owner['commercial_only']??false)===true||($owner['allow_out_of_stock']??false)===true,
                    'unit_tax_incl'=>self::decimal($product['price_wt'] ?? null),
                    'unit_tax_excl'=>self::decimal($product['price_with_reduction_without_tax'] ?? null),
                    'line_tax_incl'=>self::decimal($product['total_wt'] ?? null),
                    'line_tax_excl'=>self::decimal($product['total'] ?? null),
                ];
            }
            // These are native cart totals, not reconstructed product previews.
            $totalIncl=$cart->getOrderTotal(true,\Cart::BOTH);
            $totalExcl=$cart->getOrderTotal(false,\Cart::BOTH);
            $quote=[
                'cart_id'=>$cartId,'shop_id'=>(int)$cart->id_shop,
                'customer_id'=>(int)$cart->id_customer,'invoice_address_id'=>(int)$cart->id_address_invoice,
                'delivery_address_id'=>(int)$cart->id_address_delivery,'currency_id'=>(int)$cart->id_currency,
                'currency'=>(string)$currency->iso_code,'language_id'=>(int)$cart->id_lang,
                'carrier_id'=>(int)$cart->id_carrier,'lines'=>$lines,
                'total_tax_incl'=>self::decimal($totalIncl),'total_tax_excl'=>self::decimal($totalExcl),
                'products_tax_incl'=>self::decimal($cart->getOrderTotal(true,\Cart::ONLY_PRODUCTS)),
                'products_tax_excl'=>self::decimal($cart->getOrderTotal(false,\Cart::ONLY_PRODUCTS)),
                'shipping_tax_incl'=>self::decimal($cart->getOrderTotal(true,\Cart::ONLY_SHIPPING)),
                'discounts_tax_incl'=>self::decimal($cart->getOrderTotal(true,\Cart::ONLY_DISCOUNTS)),
                'round_mode'=>(int)\Configuration::get('PS_PRICE_ROUND_MODE'),
                'round_type'=>(int)\Configuration::get('PS_ROUND_TYPE'),
            ];
            if(($owner['commercial_only']??false)===true)$quote['commercial_only']=true;
            if(isset($owner['sale_note']))$quote['sale_note_hash']=hash('sha256',NativeSaleNote::normalize($owner['sale_note']));
            $payable=\Tools::ps_round((float)$totalIncl,2,$quote['round_mode']);
            $decimal=number_format($payable,2,'.','');
            Protocol::ensure(preg_match('/^(0|[1-9][0-9]{0,8})\.[0-9]{2}$/D',$decimal)===1,'CART_TOTAL_INVALID');
            $quote['total_cents']=(int)str_replace('.','',$decimal);
            Protocol::ensure($quote['total_cents']>0,'CART_TOTAL_INVALID');
            return ['verified'=>true,'native_reference'=>$cartId,'quoted_at'=>(int)floor(microtime(true)*1000),'quote'=>$quote,
                'quote_fingerprint'=>hash('sha256',Protocol::canonical($quote))];
        } finally {
            $manager->restorePreviousContext();
        }
    }

    public function reconcile(array $command,array $claim): ?array
    {
        // Recalculating may attach cart rules: recovery must not claim to be a
        // read-only retry. A lost quote can be requested as a NEW quote operation.
        return null;
    }

    private static function decimal($value): string
    {
        Protocol::ensure((is_string($value)||is_int($value)||is_float($value)) && is_numeric($value) &&
            is_finite((float)$value) && (float)$value>=0 && (float)$value<=1000000000,'NATIVE_AMOUNT_INVALID');
        return number_format((float)$value,6,'.','');
    }
}
