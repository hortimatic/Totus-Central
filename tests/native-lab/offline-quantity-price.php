<?php
require __DIR__.'/bootstrap.php';
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,32,JSON_THROW_ON_ERROR);
$id=(int)($argv[1]??0);$product=new Product($id);
nativeLabCheck(($fixture['mode']??null)==='local-native-fixture'&&(int)$fixture['productId']===$id&&Validate::isLoadedObject($product)&&str_starts_with($product->reference,'QA-'),'Only the current isolated fixture may receive a quantity price.');
$price=new SpecificPrice();$price->id_product=$id;$price->id_product_attribute=0;$price->id_shop=1;$price->id_shop_group=0;
$price->id_currency=0;$price->id_country=0;$price->id_group=0;$price->id_customer=0;$price->id_cart=0;
$price->price=-1;$price->from_quantity=3;$price->reduction=0.1;$price->reduction_tax=1;$price->reduction_type='percentage';
$price->from='0000-00-00 00:00:00';$price->to=date('Y-m-d H:i:s',time()+300);
nativeLabCheck($price->add(),'Cannot create isolated quantity discount.');
echo json_encode(['productId'=>$id,'fromQuantity'=>3,'discountPercent'=>10],JSON_THROW_ON_ERROR)."\n";
