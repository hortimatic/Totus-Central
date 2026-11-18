<?php
require __DIR__.'/bootstrap.php';nativeLabKernel();define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$context->employee=new Employee(1);$suffix=bin2hex(random_bytes(5));$lang=(int)$context->language->id;
$product=new Product();$product->name=[$lang=>'QA scan boundary '.$suffix];$product->link_rewrite=[$lang=>'qa-scan-boundary-'.$suffix];$product->reference='QA-SCAN-'.$suffix;
$product->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$product->price='1.000000';$product->active=true;$product->available_for_order=true;$product->minimal_quantity=1;
nativeLabCheck($product->add(),'Cannot create boundary fixture product');echo json_encode(['productId'=>(int)$product->id],JSON_THROW_ON_ERROR)."\n";
