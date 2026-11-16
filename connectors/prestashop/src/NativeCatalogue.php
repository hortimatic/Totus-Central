<?php
namespace TotusCentralConnector;

/** Bounded read-only POS search. Native pricing supplies each preview; no cart
 * is stored, no catalogue is copied into Central and no catalogue price changes.
 */
final class NativeCatalogue
{
    private static function integer($value,int $min,int $max): int
    {Protocol::ensure(is_string($value)&&preg_match('/^(0|[1-9][0-9]*)$/D',$value)===1&&
        (float)$value>=$min&&(float)$value<=$max,'CATALOGUE_QUERY_INVALID');return (int)$value;}
    public static function read(array $query,array $profile): array
    {
        $page=self::integer((string)($query['page']??'0'),0,1000);$size=self::integer((string)($query['page_size']??'20'),1,50);
        $productId=self::integer((string)($query['product_id']??'0'),0,2147483647);
        $search=$query['search']??'';
        Protocol::ensure(is_string($search)&&strlen($search)<=480&&!preg_match('/[\x00-\x1f]/',$search)&&
            mb_check_encoding($search,'UTF-8')&&mb_strlen($search,'UTF-8')<=120,'CATALOGUE_QUERY_INVALID');$search=trim($search);
        $customerId=self::integer((string)($query['customer_id']??$profile['counter_customer_id']??'0'),1,2147483647);
        $customer=new \Customer($customerId);
        Protocol::ensure(\Validate::isLoadedObject($customer)&&$customer->active&&!$customer->deleted&&NativeCustomers::inShop($customer,(int)$profile['shop_id']),'CATALOGUE_CUSTOMER_INVALID');
        $addressId=isset($query['address_id'])?self::integer((string)$query['address_id'],1,2147483647):
            ($customerId===($profile['counter_customer_id']??0)?($profile['counter_address_id']??0):(int)\Address::getFirstCustomerAddressId($customerId));
        $address=new \Address((int)$addressId);
        Protocol::ensure(\Validate::isLoadedObject($address)&&!$address->deleted&&(int)$address->id_customer===$customerId,
            'CATALOGUE_ADDRESS_INVALID');
        $context=\Context::getContext();$manager=new \PrestaShop\PrestaShop\Adapter\ContextStateManager(new \PrestaShop\PrestaShop\Adapter\LegacyContext());
        $db=\Db::getInstance()->getLink();$shop=(int)$profile['shop_id'];$language=(int)$profile['language_id'];
        try{
            $manager->setShop(new \Shop($shop));$manager->setCustomer($customer);$manager->setCurrency(new \Currency($profile['currency_id']));
            $manager->setLanguage(new \Language($language));$manager->setCountry(new \Country((int)$address->id_country));
            $preview=new \Cart();$preview->id_customer=$customerId;$preview->id_currency=(int)$profile['currency_id'];
            $preview->id_address_invoice=(int)$address->id;$preview->id_address_delivery=(int)$address->id;$manager->setCart($preview);
            $parameters=[$shop,$shop,$language];
            $sql='SELECT p.id_product,pl.name,p.reference,p.ean13,p.upc,ps.cache_default_attribute
                FROM `'._DB_PREFIX_.'product` p JOIN `'._DB_PREFIX_.'product_shop` ps ON ps.id_product=p.id_product AND ps.id_shop=?
                JOIN `'._DB_PREFIX_.'product_lang` pl ON pl.id_product=p.id_product AND pl.id_shop=? AND pl.id_lang=?
                WHERE ps.active=1 AND ps.available_for_order=1 AND ps.advanced_stock_management=0 AND p.is_virtual=0 AND p.cache_is_pack=0';
            if($productId>0){$sql.=' AND p.id_product=?';$parameters[]=$productId;}
            if($search!==''){
                $needle='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
                $sql.=" AND (pl.name LIKE ? ESCAPE '!' OR p.reference LIKE ? ESCAPE '!' OR p.ean13 LIKE ? ESCAPE '!' OR p.upc LIKE ? ESCAPE '!'
                    OR EXISTS(SELECT 1 FROM `"._DB_PREFIX_."product_attribute` pa JOIN `"._DB_PREFIX_."product_attribute_shop` pas
                    ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=? WHERE pa.id_product=p.id_product
                    AND (pa.reference LIKE ? ESCAPE '!' OR pa.ean13 LIKE ? ESCAPE '!' OR pa.upc LIKE ? ESCAPE '!'))
                    OR EXISTS(SELECT 1 FROM `"._DB_PREFIX_."product_attribute` pa JOIN `"._DB_PREFIX_."product_attribute_shop` pas
                    ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                    JOIN `"._DB_PREFIX_."product_attribute_combination` pac ON pac.id_product_attribute=pa.id_product_attribute
                    JOIN `"._DB_PREFIX_."attribute_lang` al ON al.id_attribute=pac.id_attribute AND al.id_lang=?
                    WHERE pa.id_product=p.id_product AND al.name LIKE ? ESCAPE '!'))";
                array_push($parameters,$needle,$needle,$needle,$needle,$shop,$needle,$needle,$needle,$shop,$language,$needle);
            }
            $sql.=' ORDER BY pl.name,p.id_product LIMIT '.($productId>0?1:($size+1)).' OFFSET '.($productId>0?0:$page*$size);
            $s=$db->prepare($sql);$s->execute($parameters);$products=$s->fetchAll(\PDO::FETCH_ASSOC);$rows=[];$more=false;
            if($productId>0){
                Protocol::ensure(count($products)===1,'CATALOGUE_PRODUCT_UNAVAILABLE');$parent=$products[0];
                $s=$db->prepare('SELECT pa.id_product_attribute,pa.reference,pa.ean13,pa.upc FROM `'._DB_PREFIX_.'product_attribute` pa
                    JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                    WHERE pa.id_product=? ORDER BY pa.id_product_attribute LIMIT '.($size+1).' OFFSET '.($page*$size));
                $s->execute([$shop,$productId]);$variants=$s->fetchAll(\PDO::FETCH_ASSOC);$more=count($variants)>$size;
                foreach(array_slice($variants,0,$size) as $variant)$rows[]=self::item($parent,(int)$variant['id_product_attribute'],false,
                    $variant,$profile,$context,(int)$address->id,$customerId);
            }else{
                $more=count($products)>$size;
                foreach(array_slice($products,0,$size) as $product){
                    $attribute=(int)$product['cache_default_attribute'];
                    if($attribute===0){$s=$db->prepare('SELECT MIN(id_product_attribute) FROM `'._DB_PREFIX_.'product_attribute_shop` WHERE id_product=? AND id_shop=?');
                        $s->execute([(int)$product['id_product'],$shop]);$attribute=(int)$s->fetchColumn();}
                    $choose=$attribute>0;$variant=null;
                    if($choose&&$search!==''){
                        $s=$db->prepare('SELECT pa.id_product_attribute,pa.reference,pa.ean13,pa.upc FROM `'._DB_PREFIX_.'product_attribute` pa
                            JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                            WHERE pa.id_product=? AND (pa.reference=? OR pa.ean13=? OR pa.upc=?) LIMIT 2');
                        $s->execute([$shop,(int)$product['id_product'],$search,$search,$search]);$exact=$s->fetchAll(\PDO::FETCH_ASSOC);
                        if(count($exact)===1){$variant=$exact[0];$attribute=(int)$variant['id_product_attribute'];$choose=false;}
                    }
                    $rows[]=self::item($product,$attribute,$choose,$variant,$profile,$context,(int)$address->id,$customerId);
                }
            }
            return ['items'=>$rows,'page'=>$page,'page_size'=>$size,'has_more'=>$more,'currency'=>$context->currency->iso_code,
                'payable_cart_quote'=>false,'source'=>'native-product-price','catalogue_copied'=>false];
        }finally{$manager->restorePreviousContext();}
    }
    private static function item(array $product,int $attribute,bool $choose,?array $variant,array $profile,$context,int $address,int $customer): array
    {
        $id=(int)$product['id_product'];$specific=null;
        $incl=\Product::getPriceStatic($id,true,$attribute,6,null,false,true,1,false,$customer,null,$address,$specific,true,true,$context,true);
        $excl=\Product::getPriceStatic($id,false,$attribute,6,null,false,true,1,false,$customer,null,$address,$specific,true,true,$context,true);
        Protocol::ensure(is_numeric($incl)&&is_numeric($excl)&&$incl>=0&&$excl>=0,'CATALOGUE_PRICE_INVALID');
        $label='';$minimum=1;
        if($attribute>0){$combination=new \Combination($attribute);Protocol::ensure(\Validate::isLoadedObject($combination)&&(int)$combination->id_product===$id,'CATALOGUE_VARIANT_INVALID');
            $label=implode(' · ',array_column($combination->getAttributesName((int)$profile['language_id']),'name'));$minimum=(int)$combination->minimal_quantity;}
        else{$native=new \Product($id,false,(int)$profile['language_id'],(int)$profile['shop_id']);$minimum=(int)$native->minimal_quantity;}
        $cover=\Image::getCover($id);$image=(int)($cover['id_image']??0);
        return ['id'=>$id.':'.$attribute,'product_id'=>$id,'attribute_id'=>$attribute,'name'=>(string)$product['name'],
            'variant_name'=>$label,'reference'=>(string)($variant['reference']??$product['reference']),
            'ean'=>(string)($variant['ean13']??$product['ean13']),'upc'=>(string)($variant['upc']??$product['upc']),'choose_variant'=>$choose,
            'minimum_quantity'=>max(1,$minimum),'stock'=>(int)\StockAvailable::getQuantityAvailableByProduct($id,$choose?0:$attribute,(int)$profile['shop_id']),
            'unit_tax_incl'=>number_format((float)$incl,6,'.',''),'unit_tax_excl'=>number_format((float)$excl,6,'.',''),
            'preview_cents'=>(int)round(100*\Tools::ps_round((float)$incl,2)),
            'image_path'=>$image>0?'/img/p/'.\Image::getImgFolderStatic($image).$image.'.jpg':null];
    }
}
