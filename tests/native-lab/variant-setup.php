<?php
require __DIR__.'/bootstrap.php';
$source=new Product((int)($argv[1]??0));nativeLabCheck(Validate::isLoadedObject($source),'Missing fixture tax source.');
$run=bin2hex(random_bytes(6));$lang=(int)$context->language->id;
$product=new Product();$product->name=[$lang=>'Totus variantes QA '.$run];$product->link_rewrite=[$lang=>'totus-variantes-'.$run];
$product->reference='QA-VARIANT-'.$run;$product->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');
$product->id_tax_rules_group=(int)$source->id_tax_rules_group;$product->price='6.621570';$product->active=true;
$product->available_for_order=true;$product->minimal_quantity=1;$product->is_virtual=false;
nativeLabCheck($product->add()&&$product->addToCategories([(int)$product->id_category_default]),'Cannot create variant fixture product.');
$group=new AttributeGroup();$group->name=[$lang=>'Acabado QA '.$run];$group->public_name=[$lang=>'Acabado QA'];$group->group_type='select';$group->is_color_group=false;
nativeLabCheck($group->add(),'Cannot create fixture attribute group.');$variants=[];
foreach(['A','B'] as $index=>$name){$attribute=new ProductAttribute();$attribute->id_attribute_group=(int)$group->id;$attribute->name=[$lang=>$name];
 nativeLabCheck($attribute->add(),'Cannot create fixture attribute.');
 $combination=new Combination();$combination->id_product=(int)$product->id;$combination->reference='QA-'.$run.'-'.$name;
 $combination->price=$index;$combination->minimal_quantity=1;$combination->default_on=$index===0?1:null;
 nativeLabCheck($combination->add()&&$combination->setAttributes([(int)$attribute->id]),'Cannot create fixture combination.');
 StockAvailable::setQuantity((int)$product->id,(int)$combination->id,5,1);
 $variants[]=['attributeId'=>(int)$combination->id,'reference'=>$combination->reference];
}
Product::updateDefaultAttribute((int)$product->id);
echo json_encode(['productId'=>(int)$product->id,'variants'=>$variants],JSON_THROW_ON_ERROR)."\n";
