<?php
require __DIR__.'/bootstrap.php';
$source=new Product((int)($argv[1]??0));nativeLabCheck(Validate::isLoadedObject($source)&&str_starts_with($source->reference,'QA-'),'Only disposable QA sources are allowed.');
$run=bin2hex(random_bytes(5));$lang=(int)$context->language->id;$items=[];
foreach(['allowed'=>[0,1],'denied'=>[0,0],'negative'=>[-2,1]] as $kind=>[$quantity,$rule]){
 $p=new Product();$p->name=[$lang=>'Existencias QA '.$kind.' '.$run];$p->link_rewrite=[$lang=>'existencias-qa-'.$kind.'-'.$run];$p->reference='QA-OOSP-'.$run.'-'.$kind;
 $p->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$p->id_tax_rules_group=(int)$source->id_tax_rules_group;$p->price='6.621570';$p->active=true;$p->available_for_order=true;$p->minimal_quantity=1;
 nativeLabCheck($p->add()&&$p->addToCategories([(int)$p->id_category_default]),'Cannot create stock-policy fixture.');
 StockAvailable::setQuantity((int)$p->id,0,$quantity,1);StockAvailable::setProductOutOfStock((int)$p->id,$rule,1);
 $items[$kind]=['id'=>(int)$p->id,'reference'=>$p->reference,'quantity'=>$quantity,'allowOutOfStock'=>(bool)$rule];
}
$variant=new Product((int)($argv[2]??0));$combination=new Combination((int)($argv[3]??0));
nativeLabCheck(Validate::isLoadedObject($variant)&&str_starts_with($variant->reference,'QA-VARIANT-')&&Validate::isLoadedObject($combination)&&(int)$combination->id_product===(int)$variant->id,'Only disposable QA combinations are allowed.');
$variant->reference='QA-OOSP-'.$run.'-variant';nativeLabCheck($variant->update(),'Cannot assign variant policy reference.');StockAvailable::setProductOutOfStock((int)$variant->id,1,1);
$attributes=array_unique(array_column($variant->getAttributeCombinations($lang),'id_product_attribute'));foreach($attributes as $id)StockAvailable::setQuantity((int)$variant->id,(int)$id,(int)$id===(int)$combination->id?0:-1,1);
$items['variant']=['id'=>(int)$variant->id,'attributeId'=>(int)$combination->id,'reference'=>$variant->reference,'quantity'=>0,'allowOutOfStock'=>true];
echo json_encode(['prefix'=>'QA-OOSP-'.$run,'items'=>$items],JSON_THROW_ON_ERROR)."\n";
