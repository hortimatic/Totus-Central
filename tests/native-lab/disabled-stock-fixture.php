<?php
require __DIR__.'/bootstrap.php';
$source=new Product((int)($argv[1]??0));$parent=new Product((int)($argv[2]??0));
nativeLabCheck(Validate::isLoadedObject($source)&&str_starts_with($source->reference,'QA-')&&Validate::isLoadedObject($parent)&&str_starts_with($parent->reference,'QA-VARIANT-'),'Disposable QA products required.');
$prefix='QA-DISABLED-'.bin2hex(random_bytes(5));$lang=(int)$context->language->id;$items=[];
foreach(['inactive','catalogue-only'] as $kind){
 $p=new Product();$p->name=[$lang=>'Reposición '.$kind.' '.$prefix];$p->link_rewrite=[$lang=>strtolower($prefix.'-'.$kind)];$p->reference=$prefix.'-'.$kind;
 $p->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$p->id_tax_rules_group=(int)$source->id_tax_rules_group;$p->price='6.621570';$p->active=$kind!=='inactive';$p->available_for_order=$kind!=='catalogue-only';$p->minimal_quantity=1;
 nativeLabCheck($p->add()&&$p->addToCategories([(int)$p->id_category_default]),'Cannot prepare disabled-stock fixture.');StockAvailable::setQuantity((int)$p->id,0,2,1);
 $items[$kind]=['id'=>(int)$p->id,'reference'=>$p->reference,'stock'=>2,'active'=>(bool)$p->active,'availableForOrder'=>(bool)$p->available_for_order];
}
$parent->active=false;$parent->reference=$prefix.'-variants';nativeLabCheck($parent->update(),'Cannot prepare disabled variant parent.');
echo json_encode(['prefix'=>$prefix,'items'=>$items,'variantProductId'=>(int)$parent->id,'variantReference'=>$parent->reference],JSON_THROW_ON_ERROR)."\n";
