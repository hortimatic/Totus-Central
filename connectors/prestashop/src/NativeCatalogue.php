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
    private static function searchFields(array $query): array
    {
        $value=$query['search_fields']??'reference,ean13,upc,name';
        Protocol::ensure(is_string($value)&&strlen($value)<=40,'CATALOGUE_SEARCH_FIELDS_INVALID');
        $fields=explode(',',$value);$allowed=['reference','ean13','upc','isbn','name'];
        Protocol::ensure(count($fields)>=1&&count($fields)<=5&&count(array_unique($fields))===count($fields)&&!array_diff($fields,$allowed),'CATALOGUE_SEARCH_FIELDS_INVALID');
        return array_values(array_intersect($allowed,$fields));
    }
    private static function catalogueFilters(array $query): array
    {
        $hide=self::integer($query['hide_unavailable']??'0',0,1)===1;$value=$query['excluded_categories']??'';
        Protocol::ensure(is_string($value)&&strlen($value)<=1099,'CATALOGUE_FILTER_INVALID');$ids=$value===''?[]:explode(',',$value);
        Protocol::ensure(count($ids)<=100&&count(array_unique($ids))===count($ids),'CATALOGUE_FILTER_INVALID');
        $ids=array_map(static fn($id)=>self::integer($id,1,2147483647),$ids);sort($ids,SORT_NUMERIC);
        return ['hideUnavailable'=>$hide,'excludedCategories'=>$ids];
    }
    private static function stockSql(string $product,string $attribute,int $shop): string
    {return 'COALESCE((SELECT SUM(sa.quantity) FROM `'._DB_PREFIX_.'stock_available` sa WHERE sa.id_product='.$product.' AND sa.id_product_attribute='.$attribute.\StockAvailable::addSqlShopRestriction(null,$shop,'sa').'),0)';}
    public static function read(array $query,array $profile): array
    {
        $categoriesOnly=self::integer((string)($query['categories_only']??'0'),0,1);
        if($categoriesOnly===1)return self::categories($profile);
        $searchFields=self::searchFields($query);
        $catalogueFilters=self::catalogueFilters($query);$hideUnavailable=$catalogueFilters['hideUnavailable'];
        $categoryId=self::integer((string)($query['category_id']??'0'),0,2147483647);
        $page=self::integer((string)($query['page']??'0'),0,1000);$size=self::integer((string)($query['page_size']??'20'),1,50);
        $productId=self::integer((string)($query['product_id']??'0'),0,2147483647);
        $sortGroupId=self::integer((string)($query['sort_group_id']??'0'),0,2147483647);
        Protocol::ensure($productId>0||$sortGroupId===0,'CATALOGUE_VARIANT_GROUP_INVALID');$variantGroups=[];
        $sort=$query['sort_field']??'name';$direction=$query['sort_direction']??'asc';
        Protocol::ensure(is_string($sort)&&in_array($sort,['name','reference','stock','id','cost','manufacturer','supplier','price'],true)&&
            in_array($direction,['asc','desc'],true),'CATALOGUE_SORT_INVALID');
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
            $sql='SELECT p.id_product,pl.name,p.reference,p.ean13,p.upc,p.isbn,ps.cache_default_attribute,ps.wholesale_price,
                COALESCE(m.name,\'\') manufacturer_name,COALESCE(supplier.name,\'\') supplier_name
                FROM `'._DB_PREFIX_.'product` p JOIN `'._DB_PREFIX_.'product_shop` ps ON ps.id_product=p.id_product AND ps.id_shop=?
                JOIN `'._DB_PREFIX_.'product_lang` pl ON pl.id_product=p.id_product AND pl.id_shop=? AND pl.id_lang=?
                LEFT JOIN `'._DB_PREFIX_.'manufacturer` m ON m.id_manufacturer=p.id_manufacturer
                LEFT JOIN `'._DB_PREFIX_.'supplier` supplier ON supplier.id_supplier=p.id_supplier
                WHERE ps.active=1 AND ps.available_for_order=1 AND ps.advanced_stock_management=0 AND p.is_virtual=0 AND p.cache_is_pack=0';
            if($hideUnavailable){
                $variantsExist='EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'product_attribute_shop` vas WHERE vas.id_product=p.id_product AND vas.id_shop='.$shop.')';
                $sql.=' AND (EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'product_attribute` pa JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop='.$shop.' WHERE pa.id_product=p.id_product AND '.self::stockSql('pa.id_product','pa.id_product_attribute',$shop).'>0) OR (NOT '.$variantsExist.' AND '.self::stockSql('p.id_product','0',$shop).'>0))';
            }
            if($catalogueFilters['excludedCategories']){
                $ids=$catalogueFilters['excludedCategories'];$categories=$db->prepare('SELECT c.nleft,c.nright FROM `'._DB_PREFIX_.'category` c JOIN `'._DB_PREFIX_.'category_shop` cs ON cs.id_category=c.id_category AND cs.id_shop=? WHERE c.active=1 AND c.id_category IN ('.implode(',',array_fill(0,count($ids),'?')).')');
                $categories->execute(array_merge([$shop],$ids));$bounds=$categories->fetchAll(\PDO::FETCH_ASSOC);
                Protocol::ensure(count($bounds)===count($ids),'CATALOGUE_FILTER_CATEGORY_INVALID');$ranges=[];$parameters[]=$shop;
                foreach($bounds as $range){$ranges[]='(tree.nleft>=? AND tree.nright<=?)';array_push($parameters,(int)$range['nleft'],(int)$range['nright']);}
                $sql.=' AND NOT EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'category_product` cp JOIN `'._DB_PREFIX_.'category` tree ON tree.id_category=cp.id_category JOIN `'._DB_PREFIX_.'category_shop` ts ON ts.id_category=tree.id_category AND ts.id_shop=? WHERE cp.id_product=p.id_product AND ('.implode(' OR ',$ranges).'))';
            }
            if($categoryId>0){
                $category=$db->prepare('SELECT c.nleft,c.nright FROM `'._DB_PREFIX_.'category` c JOIN `'._DB_PREFIX_.'category_shop` cs ON cs.id_category=c.id_category AND cs.id_shop=? WHERE c.id_category=? AND c.active=1');
                $category->execute([$shop,$categoryId]);$bounds=$category->fetch(\PDO::FETCH_ASSOC);
                Protocol::ensure($bounds!==false,'CATALOGUE_CATEGORY_INVALID');
                $sql.=' AND EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'category_product` cp JOIN `'._DB_PREFIX_.'category` tree ON tree.id_category=cp.id_category JOIN `'._DB_PREFIX_.'category_shop` ts ON ts.id_category=tree.id_category AND ts.id_shop=? WHERE cp.id_product=p.id_product AND tree.active=1 AND tree.nleft>=? AND tree.nright<=?)';
                array_push($parameters,$shop,(int)$bounds['nleft'],(int)$bounds['nright']);
            }
            if($productId>0){$sql.=' AND p.id_product=?';$parameters[]=$productId;}
            if($search!==''){
                $needle='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
                $terms=[];$variantTerms=[];
                foreach($searchFields as $field){$terms[]=($field==='name'?'pl.name':'p.'.$field)." LIKE ? ESCAPE '!'";$parameters[]=$needle;
                    if($field!=='name')$variantTerms[]='pa.'.$field." LIKE ? ESCAPE '!'";}
                if($variantTerms){$terms[]='EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'product_attribute` pa JOIN `'._DB_PREFIX_.'product_attribute_shop` pas
                    ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=? WHERE pa.id_product=p.id_product'.($hideUnavailable?' AND '.self::stockSql('pa.id_product','pa.id_product_attribute',$shop).'>0':'').' AND ('.implode(' OR ',$variantTerms).'))';
                    $parameters[]=$shop;foreach($variantTerms as $_)$parameters[]=$needle;}
                if(in_array('name',$searchFields,true)){
                    $terms[]="EXISTS(SELECT 1 FROM `"._DB_PREFIX_."product_attribute` pa JOIN `"._DB_PREFIX_."product_attribute_shop` pas
                        ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                        JOIN `"._DB_PREFIX_."product_attribute_combination` pac ON pac.id_product_attribute=pa.id_product_attribute
                        JOIN `"._DB_PREFIX_."attribute_lang` al ON al.id_attribute=pac.id_attribute AND al.id_lang=?
                        WHERE pa.id_product=p.id_product AND al.name LIKE ? ESCAPE '!')";
                    array_push($parameters,$shop,$language,$needle);}
                $sql.=' AND ('.implode(' OR ',$terms).')';
            }
            $total=0;
            if($productId===0){$count=$db->prepare('SELECT COUNT(*) FROM ('.$sql.') catalogue_matches');$count->execute($parameters);$total=(int)$count->fetchColumn();}
            if($sort==='price')Protocol::ensure($total<=200000,'CATALOGUE_INDEX_LIMIT');
            $stockRestriction=\StockAvailable::addSqlShopRestriction(null,$shop,'sa');
            $stock='COALESCE((SELECT SUM(sa.quantity) FROM `'._DB_PREFIX_.'stock_available` sa WHERE sa.id_product=p.id_product AND sa.id_product_attribute=0'.$stockRestriction.'),0)';
            $orders=['name'=>'TRIM(pl.name)','reference'=>'p.reference','stock'=>$stock,'id'=>'p.id_product','price'=>'p.id_product',
                'cost'=>'ps.wholesale_price','manufacturer'=>'COALESCE(m.name,\'\')','supplier'=>'COALESCE(supplier.name,\'\')'];
            $pricePage=null;$priceValues=[];
            $sql.=' ORDER BY '.$orders[$sort].' '.strtoupper($direction).',p.id_product '.strtoupper($direction);
            if($sort!=='price'||$productId>0)$sql.=' LIMIT '.($productId>0?1:($size+1)).' OFFSET '.($productId>0?0:$page*$size);
            $s=$db->prepare($sql);$s->execute($parameters);$products=$s->fetchAll(\PDO::FETCH_ASSOC);$rows=[];$more=false;
            if($sort==='price'&&$productId===0){
                $byId=[];foreach($products as $product)$byId[$product['id_product'].':0']=$product;ksort($byId,SORT_NATURAL);
                $pricePage=self::pricePage(array_keys($byId),static function($key)use($byId,$search,$shop,$profile,$context,$address,$customerId,$searchFields,$hideUnavailable){
                    [$attribute]=self::selection($byId[$key],$search,$shop,$searchFields,$hideUnavailable);
                    return self::previewPrice((int)$byId[$key]['id_product'],$attribute,$context,(int)$address->id,$customerId);
                },$profile,$context,$customer,$address,$search,$categoryId,0,$page,$size,$direction,$searchFields,$catalogueFilters);
                if(!$pricePage['ready'])return self::building($pricePage,$page,$size,$context,$direction)+['search_fields'=>$searchFields,'catalogue_filters'=>$catalogueFilters];
                $priceValues=$pricePage['prices'];$products=array_map(static fn($key)=>$byId[$key],$pricePage['ids']);
            }
            if($productId>0){
                Protocol::ensure(count($products)===1,'CATALOGUE_PRODUCT_UNAVAILABLE');$parent=$products[0];
                $groups=$db->prepare('SELECT DISTINCT ag.id_attribute_group,COALESCE(NULLIF(agl.public_name,\'\'),agl.name) name,ag.position FROM `'._DB_PREFIX_.'product_attribute` pa JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=? JOIN `'._DB_PREFIX_.'product_attribute_combination` pac ON pac.id_product_attribute=pa.id_product_attribute JOIN `'._DB_PREFIX_.'attribute` a ON a.id_attribute=pac.id_attribute JOIN `'._DB_PREFIX_.'attribute_group` ag ON ag.id_attribute_group=a.id_attribute_group JOIN `'._DB_PREFIX_.'attribute_group_lang` agl ON agl.id_attribute_group=ag.id_attribute_group AND agl.id_lang=? WHERE pa.id_product=? ORDER BY ag.position,ag.id_attribute_group LIMIT 65');
                $groups->execute([$shop,$language,$productId]);$nativeGroups=$groups->fetchAll(\PDO::FETCH_ASSOC);Protocol::ensure(count($nativeGroups)<=64,'CATALOGUE_VARIANT_ATTRIBUTES_LIMIT');
                $variantGroups=array_map(static fn($row)=>['id'=>(int)$row['id_attribute_group'],'name'=>(string)$row['name']],$nativeGroups);
                Protocol::ensure($sortGroupId===0||in_array($sortGroupId,array_column($variantGroups,'id'),true),'CATALOGUE_VARIANT_GROUP_INVALID');
                $variantStock=self::stockSql('pa.id_product','pa.id_product_attribute',$shop);$variantAvailability=$hideUnavailable?' AND '.$variantStock.'>0':'';
                $count=$db->prepare('SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_attribute` pa JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=? WHERE pa.id_product=?'.$variantAvailability);
                $count->execute([$shop,$productId]);$total=(int)$count->fetchColumn();
                if($sort==='price')Protocol::ensure($total<=200000,'CATALOGUE_INDEX_LIMIT');
                $variantName='COALESCE((SELECT GROUP_CONCAT(al.name ORDER BY ag.position,a.position,a.id_attribute SEPARATOR \' · \') FROM `'._DB_PREFIX_.'product_attribute_combination` pac JOIN `'._DB_PREFIX_.'attribute` a ON a.id_attribute=pac.id_attribute JOIN `'._DB_PREFIX_.'attribute_group` ag ON ag.id_attribute_group=a.id_attribute_group JOIN `'._DB_PREFIX_.'attribute_lang` al ON al.id_attribute=a.id_attribute AND al.id_lang='.(int)$language.' WHERE pac.id_product_attribute=pa.id_product_attribute'.($sortGroupId>0?' AND a.id_attribute_group='.$sortGroupId:'').'),\'\')';
                $variantOrder=['name'=>'TRIM(variant_sort_name)','reference'=>'pa.reference','stock'=>$variantStock,'id'=>'pa.id_product_attribute','price'=>'pa.id_product_attribute',
                    'cost'=>'pa.id_product_attribute','manufacturer'=>'pa.id_product_attribute','supplier'=>'pa.id_product_attribute'];
                $s=$db->prepare('SELECT pa.id_product_attribute,pa.reference,pa.ean13,pa.upc,pa.isbn,pas.wholesale_price,'.$variantName.' variant_sort_name FROM `'._DB_PREFIX_.'product_attribute` pa
                    JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                    WHERE pa.id_product=?'.$variantAvailability.' ORDER BY '.$variantOrder[$sort].' '.strtoupper($direction).',pa.id_product_attribute '.strtoupper($direction).
                    ($sort==='price'?'':' LIMIT '.($size+1).' OFFSET '.($page*$size)));
                $s->execute([$shop,$productId]);$variants=$s->fetchAll(\PDO::FETCH_ASSOC);
                if($sort==='price'){
                    $byId=[];foreach($variants as $variant)$byId[$productId.':'.$variant['id_product_attribute']]=$variant;ksort($byId,SORT_NATURAL);
                    $pricePage=self::pricePage(array_keys($byId),static function($key)use($productId,$byId,$context,$address,$customerId){
                        return self::previewPrice($productId,(int)$byId[$key]['id_product_attribute'],$context,(int)$address->id,$customerId);
                    },$profile,$context,$customer,$address,$search,$categoryId,$productId,$page,$size,$direction,$searchFields,$catalogueFilters);
                    if(!$pricePage['ready'])return self::building($pricePage,$page,$size,$context,$direction)+['search_fields'=>$searchFields,'catalogue_filters'=>$catalogueFilters,'variant_groups'=>$variantGroups,'variant_group_id'=>$sortGroupId];
                    $priceValues=$pricePage['prices'];$variants=array_map(static fn($key)=>$byId[$key],$pricePage['ids']);
                }
                $more=$pricePage?$pricePage['has_more']:count($variants)>$size;
                foreach(array_slice($variants,0,$size) as $variant){$item=self::item($parent,(int)$variant['id_product_attribute'],false,
                    $variant,$profile,$context,(int)$address->id,$customerId);if($pricePage)$item['preview_cents']=$priceValues[$item['id']];$rows[]=$item;}
            }else{
                $more=$pricePage?$pricePage['has_more']:count($products)>$size;
                foreach(array_slice($products,0,$size) as $product){
                    [$attribute,$choose,$variant]=self::selection($product,$search,$shop,$searchFields,$hideUnavailable);
                    $item=self::item($product,$attribute,$choose,$variant,$profile,$context,(int)$address->id,$customerId);
                    if($pricePage)$item['preview_cents']=$priceValues[$product['id_product'].':0'];$rows[]=$item;
                }
            }
            return ['items'=>$rows,'page'=>$page,'page_size'=>$size,'has_more'=>$more,'total_count'=>$total,'currency'=>$context->currency->iso_code,
                'variant_groups'=>$variantGroups,'variant_group_id'=>$sortGroupId,'payable_cart_quote'=>false,'source'=>'native-product-price','catalogue_copied'=>false,'sort_field'=>$sort,'sort_direction'=>$direction,'search_fields'=>$searchFields,'catalogue_filters'=>$catalogueFilters,
                ...($pricePage?['price_snapshot_at'=>$pricePage['snapshot_at']]:[])];
        }finally{$manager->restorePreviousContext();}
    }
    private static function selection(array $product,string $search,int $shop,array $searchFields,bool $hideUnavailable): array
    {
        $db=\Db::getInstance()->getLink();$attribute=(int)$product['cache_default_attribute'];
        if($attribute===0){$s=$db->prepare('SELECT MIN(id_product_attribute) FROM `'._DB_PREFIX_.'product_attribute_shop` WHERE id_product=? AND id_shop=?');
            $s->execute([(int)$product['id_product'],$shop]);$attribute=(int)$s->fetchColumn();}
        if($hideUnavailable&&$attribute>0){$s=$db->prepare('SELECT pa.id_product_attribute FROM `'._DB_PREFIX_.'product_attribute` pa JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=? WHERE pa.id_product=? AND '.self::stockSql('pa.id_product','pa.id_product_attribute',$shop).'>0 ORDER BY (pa.id_product_attribute=?) DESC,pa.id_product_attribute LIMIT 1');
            $s->execute([$shop,(int)$product['id_product'],$attribute]);$available=$s->fetchColumn();if($available)$attribute=(int)$available;}
        $choose=$attribute>0;$variant=null;
        $identifiers=array_values(array_filter($searchFields,static fn($field)=>$field!=='name'));
        if($choose&&$search!==''&&$identifiers){
            $s=$db->prepare('SELECT pa.id_product_attribute,pa.reference,pa.ean13,pa.upc,pa.isbn FROM `'._DB_PREFIX_.'product_attribute` pa
                JOIN `'._DB_PREFIX_.'product_attribute_shop` pas ON pas.id_product_attribute=pa.id_product_attribute AND pas.id_shop=?
                WHERE pa.id_product=?'.($hideUnavailable?' AND '.self::stockSql('pa.id_product','pa.id_product_attribute',$shop).'>0':'').' AND ('.implode(' OR ',array_map(static fn($field)=>'pa.'.$field.'=?',$identifiers)).') LIMIT 2');
            $s->execute(array_merge([$shop,(int)$product['id_product']],array_fill(0,count($identifiers),$search)));$exact=$s->fetchAll(\PDO::FETCH_ASSOC);
            if(count($exact)===1){$variant=$exact[0];$attribute=(int)$variant['id_product_attribute'];$choose=false;}
        }
        return [$attribute,$choose,$variant];
    }
    private static function previewPrice(int $id,int $attribute,$context,int $address,int $customer): int
    {
        $specific=null;$incl=\Product::getPriceStatic($id,true,$attribute,6,null,false,true,1,false,$customer,null,$address,$specific,true,true,$context,true);
        Protocol::ensure(is_numeric($incl)&&$incl>=0,'CATALOGUE_PRICE_INVALID');return (int)round(100*\Tools::ps_round((float)$incl,2));
    }
    private static function pricePage(array $ids,callable $reader,array $profile,$context,$customer,$address,string $search,int $category,int $product,int $page,int $size,string $direction,array $searchFields,array $catalogueFilters): array
    {
        $now=(int)floor(microtime(true)*1000);$local=date('Y-m-d H:i:s');$minute=date('Y-m-d H:i:00');$boundary=null;$db=\Db::getInstance()->getLink();
        foreach(['specific_price','specific_price_rule'] as $table){
            // SpecificPriceCore compares date('Y-m-d H:i:00'), including an
            // inclusive `to`. Expiring at its raw seconds would rebuild too
            // early, cache the still-active native offer, then miss its end.
            $s=$db->prepare('SELECT MIN(boundary) FROM (SELECT IF(SECOND(`from`)=0,`from`,DATE_ADD(DATE_FORMAT(`from`,\'%Y-%m-%d %H:%i:00\'),INTERVAL 1 MINUTE)) boundary FROM `'._DB_PREFIX_.$table.'` WHERE id_shop IN (0,?) AND `from`>=?
                UNION ALL SELECT DATE_ADD(DATE_FORMAT(`to`,\'%Y-%m-%d %H:%i:00\'),INTERVAL 1 MINUTE) boundary FROM `'._DB_PREFIX_.$table.'` WHERE id_shop IN (0,?) AND `to`>=?) price_boundaries WHERE boundary>?');
            $s->execute([(int)$profile['shop_id'],$minute,(int)$profile['shop_id'],$minute,$local]);$value=$s->fetchColumn();
            if($value&&($boundary===null||strcmp($value,$boundary)<0))$boundary=$value;
        }
        $validUntil=$now+300000;if($boundary){$at=(new \DateTimeImmutable($boundary))->getTimestamp()*1000;if($at>$now)$validUntil=min($validUntil,$at);}
        $groups=$customer->getGroups();sort($groups,SORT_NUMERIC);$settings=[];
        foreach(['PS_TAX','PS_TAX_ADDRESS_TYPE','PS_PRICE_ROUND_MODE','PS_ROUND_TYPE','PS_ECOTAX_TAX_RULES_GROUP_ID','PS_SPECIFIC_PRICE_PRIORITIES'] as $key)$settings[$key]=\Configuration::get($key);
        $identity=['protocol'=>2,'installation'=>$profile['installation_id'],'epoch'=>\Configuration::get('TOTUS_TPV_CATALOGUE_EPOCH'),
            'shop'=>(int)$profile['shop_id'],'language'=>(int)$profile['language_id'],'currency'=>(int)$context->currency->id,
            'conversion'=>(string)$context->currency->conversion_rate,'customer'=>(int)$customer->id,'groups'=>$groups,
            'address'=>(int)$address->id,'country'=>(int)$address->id_country,'state'=>(int)$address->id_state,
            'postcode'=>(string)$address->postcode,'vat'=>(string)$address->vat_number,'settings'=>$settings,
            'search'=>$search,'search_fields'=>$searchFields,'catalogue_filters'=>$catalogueFilters,'category'=>$category,'product'=>$product];
        $storage=NativeRuntime::connection();$index=new NativeCatalogueIndex($storage,_DB_PREFIX_.'totus_tpv_catalogue_index');
        $result=$index->page($identity,$ids,$reader,$page*$size,$size,$direction,$validUntil,$now);
        // Only disposable, expired presentation indexes are pruned. Native
        // commands, receipts and financial journals are never part of this table.
        try{$prune=$storage->prepare('DELETE FROM `'._DB_PREFIX_.'totus_tpv_catalogue_index` WHERE expires_at<? LIMIT 5');$prune->execute([$now-300000]);}catch(\Throwable $ignored){}
        return $result;
    }
    private static function building(array $index,int $page,int $size,$context,string $direction): array
    {
        return ['items'=>[],'page'=>$page,'page_size'=>$size,'has_more'=>false,'total_count'=>$index['total'],
            'currency'=>$context->currency->iso_code,'payable_cart_quote'=>false,'catalogue_copied'=>false,
            'source'=>'native-product-price','sort_field'=>'price','sort_direction'=>$direction,
            'building'=>['done'=>$index['done'],'total'=>$index['total']],'price_snapshot_at'=>$index['snapshot_at']];
    }
    private static function categories(array $profile): array
    {
        $s=\Db::getInstance()->getLink()->prepare('SELECT c.id_category,cl.name,c.id_parent,c.nleft,c.nright,COALESCE(parent.name,\'\') parent_name FROM `'._DB_PREFIX_.'category` c JOIN `'._DB_PREFIX_.'category_shop` cs ON cs.id_category=c.id_category AND cs.id_shop=? JOIN `'._DB_PREFIX_.'category_lang` cl ON cl.id_category=c.id_category AND cl.id_shop=? AND cl.id_lang=? LEFT JOIN `'._DB_PREFIX_.'category_lang` parent ON parent.id_category=c.id_parent AND parent.id_shop=cl.id_shop AND parent.id_lang=cl.id_lang WHERE c.active=1 AND c.id_category>1 ORDER BY cl.name,c.id_category LIMIT 2001');
        $s->execute([(int)$profile['shop_id'],(int)$profile['shop_id'],(int)$profile['language_id']]);$rows=$s->fetchAll(\PDO::FETCH_ASSOC);
        Protocol::ensure(count($rows)<=2000,'CATEGORY_METADATA_LIMIT');
        return ['categories'=>array_map(static fn($r)=>['id'=>(int)$r['id_category'],'name'=>(string)$r['name'],
            'parentId'=>(int)$r['id_parent'],'treeLeft'=>(int)$r['nleft'],'treeRight'=>(int)$r['nright'],'parentName'=>$r['id_parent']>2?(string)$r['parent_name']:''],$rows),'has_more'=>false];
    }
    private static function item(array $product,int $attribute,bool $choose,?array $variant,array $profile,$context,int $address,int $customer): array
    {
        $id=(int)$product['id_product'];$specific=null;
        $incl=\Product::getPriceStatic($id,true,$attribute,6,null,false,true,1,false,$customer,null,$address,$specific,true,true,$context,true);
        $excl=\Product::getPriceStatic($id,false,$attribute,6,null,false,true,1,false,$customer,null,$address,$specific,true,true,$context,true);
        Protocol::ensure(is_numeric($incl)&&is_numeric($excl)&&$incl>=0&&$excl>=0,'CATALOGUE_PRICE_INVALID');
        $label='';$minimum=1;$attributes=[];
        if($attribute>0){$combination=new \Combination($attribute);Protocol::ensure(\Validate::isLoadedObject($combination)&&(int)$combination->id_product===$id,'CATALOGUE_VARIANT_INVALID');
            $query=\Db::getInstance()->getLink()->prepare('SELECT a.id_attribute,a.id_attribute_group,al.name,agl.public_name group_name FROM `'._DB_PREFIX_.'product_attribute_combination` pac JOIN `'._DB_PREFIX_.'attribute` a ON a.id_attribute=pac.id_attribute JOIN `'._DB_PREFIX_.'attribute_group` ag ON ag.id_attribute_group=a.id_attribute_group JOIN `'._DB_PREFIX_.'attribute_lang` al ON al.id_attribute=a.id_attribute AND al.id_lang=? JOIN `'._DB_PREFIX_.'attribute_group_lang` agl ON agl.id_attribute_group=a.id_attribute_group AND agl.id_lang=? WHERE pac.id_product_attribute=? ORDER BY ag.position,a.position,a.id_attribute LIMIT 65');
            $query->execute([(int)$profile['language_id'],(int)$profile['language_id'],$attribute]);$nativeAttributes=$query->fetchAll(\PDO::FETCH_ASSOC);
            Protocol::ensure(count($nativeAttributes)<=64,'CATALOGUE_VARIANT_ATTRIBUTES_LIMIT');
            $attributes=array_map(static fn($row)=>['id'=>(int)$row['id_attribute'],'groupId'=>(int)$row['id_attribute_group'],'groupName'=>(string)$row['group_name'],'name'=>(string)$row['name']],$nativeAttributes);
            $label=implode(' · ',array_column($attributes,'name'));$minimum=(int)$combination->minimal_quantity;}
        else{$native=new \Product($id,false,(int)$profile['language_id'],(int)$profile['shop_id']);$minimum=(int)$native->minimal_quantity;}
        $cover=\Image::getCover($id);$image=(int)($cover['id_image']??0);
        return ['id'=>$id.':'.$attribute,'product_id'=>$id,'attribute_id'=>$attribute,'name'=>(string)$product['name'],
            'manufacturer'=>(string)($product['manufacturer_name']??''),'supplier'=>(string)($product['supplier_name']??''),
            'cost_base_cents'=>(int)round(100*(float)$product['wholesale_price']),
            'variant_name'=>$label,'variant_attributes'=>$attributes,'reference'=>(string)($variant['reference']??$product['reference']),
            'ean'=>(string)($variant['ean13']??$product['ean13']),'upc'=>(string)($variant['upc']??$product['upc']),'isbn'=>(string)($variant['isbn']??$product['isbn']),'choose_variant'=>$choose,
            'minimum_quantity'=>max(1,$minimum),'stock'=>(int)\StockAvailable::getQuantityAvailableByProduct($id,$choose?0:$attribute,(int)$profile['shop_id']),
            'unit_tax_incl'=>number_format((float)$incl,6,'.',''),'unit_tax_excl'=>number_format((float)$excl,6,'.',''),
            'preview_cents'=>(int)round(100*\Tools::ps_round((float)$incl,2)),
            'preview_tax_excl_cents'=>(int)round(100*\Tools::ps_round((float)$excl,2)),
            'image_path'=>$image>0?'/img/p/'.\Image::getImgFolderStatic($image).$image.'.jpg':null];
    }
}
