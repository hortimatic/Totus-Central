<?php
/** Guarded test-only catalogue edit, never a TPV production command. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
$id=(int)($argv[1]??0);$price=(string)($argv[2]??'');$product=new Product($id);
nativeLabCheck(Validate::isLoadedObject($product)&&str_starts_with($product->reference,'QA-PRICE-'),'Only owned historical-price fixtures may change.');
nativeLabCheck(preg_match('/^(0|[1-9][0-9]{0,3})\.[0-9]{6}$/D',$price)===1,'Only a bounded fixture price is allowed.');
$before=(string)$product->price;$product->price=$price;nativeLabCheck($product->update(),'Cannot change own fixture catalogue price.');Cache::clean('*');
echo json_encode(['localOnly'=>true,'productId'=>$id,'before'=>$before,'after'=>(string)(new Product($id))->price],JSON_THROW_ON_ERROR)."\n";
