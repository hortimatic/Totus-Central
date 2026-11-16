<?php
namespace TotusCentralConnector;

/** Native, cart-only reductions. Never edits a catalogue or a shared coupon. */
final class NativeCartAdjustments
{
    public static function apply(\Cart $cart,array $payload,array $command): void
    {
        $context=\Context::getContext();
        if(isset($payload['coupon'])){
            $code=$payload['coupon'];
            Protocol::ensure(is_string($code)&&$code!==''&&trim($code)===$code&&mb_strlen($code)<=100&&
                !preg_match('/[\x00-\x1f]/',$code),'CART_COUPON_INVALID');
            $id=(int)\CartRule::getIdByCode($code);$coupon=new \CartRule($id);
            Protocol::ensure(\Validate::isLoadedObject($coupon)&&$coupon->checkValidity($context,false,false)===true,
                'CART_COUPON_UNAVAILABLE');
            Protocol::ensure($cart->addCartRule($id),'CART_COUPON_APPLY_FAILED');
        }
        if(!isset($payload['adjustment']))return;
        $discount=$payload['adjustment'];
        Protocol::ensure(is_array($discount)&&count($discount)===2&&array_diff(array_keys($discount),['kind','value'])===[]&&
            in_array($discount['kind']??null,['percent','amount'],true)&&is_int($discount['value']??null)&&$discount['value']>0,
            'CART_DISCOUNT_INVALID');
        $subtotal=(float)$cart->getOrderTotal(true,\Cart::BOTH);
        Protocol::ensure($subtotal>0&&($discount['kind']==='percent'?$discount['value']<10000:$discount['value']<round(100*$subtotal)),
            'CART_DISCOUNT_INVALID');
        $rule=new \CartRule();$rule->id_customer=(int)$cart->id_customer;$rule->date_from=date('Y-m-d H:i:s',time()-60);
        $rule->date_to=date('Y-m-d H:i:s',time()+7200);$rule->description='Totus Central · venta '.$command['operation_id'];
        $rule->quantity=1;$rule->quantity_per_user=1;$rule->priority=1;$rule->partial_use=false;
        $rule->code='TOTUS-'.bin2hex(random_bytes(24));$rule->active=true;$rule->highlight=false;
        $rule->minimum_amount=0;$rule->minimum_amount_tax=true;$rule->minimum_amount_currency=(int)$cart->id_currency;
        $rule->minimum_amount_shipping=false;$rule->free_shipping=false;$rule->reduction_tax=true;
        $rule->reduction_currency=(int)$cart->id_currency;$rule->reduction_product=0;$rule->reduction_exclude_special=false;
        $rule->reduction_percent=$discount['kind']==='percent'?$discount['value']/100:0;
        $rule->reduction_amount=$discount['kind']==='amount'?$discount['value']/100:0;
        $rule->gift_product=0;$rule->gift_product_attribute=0;
        foreach(\Language::getLanguages(false) as $language)$rule->name[(int)$language['id_lang']]='Descuento TotusTPV';
        Protocol::ensure($rule->add(),'CART_DISCOUNT_CREATE_FAILED');
        Protocol::ensure($rule->checkValidity($context,false,false)===true&&$cart->addCartRule((int)$rule->id),
            'CART_DISCOUNT_APPLY_FAILED');
    }
}
