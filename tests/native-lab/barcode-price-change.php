<?php
/** Later legitimate catalogue edit, limited to the current local HTTP fixture. */
require __DIR__.'/bootstrap.php';nativeLabKernel();define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,32,JSON_THROW_ON_ERROR);
$id=(int)($argv[1]??0);$price=(string)($argv[2]??'');$product=new Product($id);
nativeLabCheck(($fixture['mode']??null)==='local-native-fixture'&&$id===(int)$fixture['productId']&&Validate::isLoadedObject($product)&&str_starts_with($product->reference,'QA-'),'Only the current fictional product may change');
nativeLabCheck(preg_match('/^(0|[1-9][0-9]{0,3})\.[0-9]{6}$/D',$price)===1,'Bounded fixture price required');
$before=(string)$product->price;$product->price=$price;$product->setFieldsToUpdate(['price'=>true]);nativeLabCheck($product->update(),'Cannot edit current fixture price');Cache::clean('*');
echo json_encode(['before'=>$before,'after'=>(string)(new Product($id))->price],JSON_THROW_ON_ERROR)."\n";
