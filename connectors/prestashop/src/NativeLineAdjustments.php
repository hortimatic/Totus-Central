<?php
namespace TotusCentralConnector;

/** A unit reduction belongs to one owned cart/product/combination. The native
 * price engine still applies country taxes, ecotax and customer group rules.
 * Reconstruct its pre-group/ex-tax amount and verify the resulting unit before
 * accepting it. No Product or public SpecificPrice record is changed.
 */
final class NativeLineAdjustments
{
    public static function apply(\Cart $cart,array $lines): void
    {
        foreach($lines as $line){
            if(!isset($line['discount']))continue;$d=$line['discount'];
            Protocol::ensure(is_array($d)&&count($d)===2&&array_diff(array_keys($d),['kind','value'])===[]&&
                in_array($d['kind']??null,['percent','amount'],true)&&is_int($d['value']??null)&&$d['value']>0,'LINE_DISCOUNT_INVALID');
            $id=$line['product_id'];$attribute=$line['attribute_id'];$quantity=$line['quantity'];$context=\Context::getContext();
            $price=static function(bool $tax,bool $group,bool $eco)use($id,$attribute,$quantity,$cart,$context): float{
                $specific=null;return (float)\Product::getPriceStatic($id,$tax,$attribute,6,null,false,true,$quantity,false,
                    (int)$cart->id_customer,(int)$cart->id,(int)$cart->id_address_delivery,$specific,$eco,$group,$context,true);
            };
            $current=$price(true,true,true);$incl=$price(true,true,false);$base=$price(false,false,false);
            Protocol::ensure($current>0&&$incl>0&&$base>0&&($d['kind']==='percent'?$d['value']<10000:$d['value']<round($current*100)),
                'LINE_DISCOUNT_INVALID');
            $target=$d['kind']==='percent'?$current*(1-$d['value']/10000):$current-$d['value']/100;
            $withoutEco=$target-($current-$incl);Protocol::ensure($withoutEco>0,'LINE_DISCOUNT_BELOW_ECOTAX');
            $specific=new \SpecificPrice();$specific->id_shop=(int)$cart->id_shop;$specific->id_shop_group=0;
            $specific->id_cart=(int)$cart->id;$specific->id_product=$id;$specific->id_product_attribute=$attribute;
            $specific->id_currency=(int)$cart->id_currency;$specific->id_country=0;$specific->id_group=0;
            $specific->id_customer=(int)$cart->id_customer;$specific->from_quantity=1;$specific->price=round($withoutEco*$base/$incl,6);
            $specific->reduction=0;$specific->reduction_type='amount';$specific->reduction_tax=false;
            $specific->from='0000-00-00 00:00:00';$specific->to='0000-00-00 00:00:00';
            Protocol::ensure($specific->add(),'LINE_DISCOUNT_SAVE_FAILED');
            \SpecificPrice::flushCache();\Product::flushPriceCache();
            Protocol::ensure(abs($price(true,true,true)-$target)<0.000003,'LINE_DISCOUNT_PRICE_MISMATCH');
        }
    }
}
