<?php
require __DIR__.'/bootstrap.php';
$product=new Product((int)($argv[1]??0));$combination=new Combination((int)($argv[2]??0));
nativeLabCheck(Validate::isLoadedObject($product)&&str_starts_with((string)$product->reference,'QA-VARIANT-')&&Validate::isLoadedObject($combination)&&(int)$combination->id_product===(int)$product->id,'Owned receipt variant fixture required.');
$lang=(int)$context->language->id;$product->name=[$lang=>'Nombre cambiado después de la venta'];$product->setFieldsToUpdate(['name'=>true]);
nativeLabCheck($product->update(),'Cannot rename owned fixture.');
$attributes=$combination->getAttributesName($lang);nativeLabCheck(count($attributes)===1,'Single fixture attribute required.');
$attribute=new ProductAttribute((int)$attributes[0]['id_attribute']);$attribute->name=[$lang=>'Nombre de variante posterior'];$attribute->setFieldsToUpdate(['name'=>true]);
nativeLabCheck($attribute->update(),'Cannot rename owned attribute.');
echo json_encode(['productId'=>(int)$product->id,'attributeId'=>(int)$combination->id,'renamed'=>true],JSON_THROW_ON_ERROR)."\n";
