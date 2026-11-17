<?php
require __DIR__.'/bootstrap.php';
$source=new Product((int)($argv[1]??0));nativeLabCheck(Validate::isLoadedObject($source)&&str_starts_with($source->reference,'QA-'),'Only disposable QA sources are allowed.');$run=bin2hex(random_bytes(5));$lang=(int)$context->language->id;$items=[];
foreach(['normal'=>'6.621570','zero'=>'0.000000'] as $kind=>$price){
 $p=new Product();$p->name=[$lang=>'Precio QA '.$kind.' '.$run];$p->link_rewrite=[$lang=>'precio-qa-'.$kind.'-'.$run];$p->reference='QA-PRICE-'.$run.'-'.$kind;$p->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$p->id_tax_rules_group=(int)$source->id_tax_rules_group;$p->price=$price;$p->active=true;$p->available_for_order=true;$p->minimal_quantity=1;
 nativeLabCheck($p->add()&&$p->addToCategories([(int)$p->id_category_default]),'Cannot create line-price fixture.');StockAvailable::setQuantity((int)$p->id,0,8,1);$items[$kind]=['id'=>(int)$p->id,'reference'=>$p->reference,'price'=>$price];
}
$variant=new Product((int)($argv[2]??0));$combination=new Combination((int)($argv[3]??0));nativeLabCheck(Validate::isLoadedObject($variant)&&str_starts_with($variant->reference,'QA-VARIANT-')&&Validate::isLoadedObject($combination)&&(int)$combination->id_product===(int)$variant->id,'Only disposable QA combinations are allowed.');
$variant->reference='QA-PRICE-'.$run.'-variant';nativeLabCheck($variant->update(),'Cannot assign line-price fixture reference.');$items['variant']=['id'=>(int)$variant->id,'attributeId'=>(int)$combination->id,'reference'=>$variant->reference,'price'=>(string)$variant->price];
echo json_encode(['prefix'=>'QA-PRICE-'.$run,'items'=>$items],JSON_THROW_ON_ERROR)."\n";
