<?php
require __DIR__.'/bootstrap.php';
function searchBarcode(string $base):string{$sum=0;for($i=0;$i<strlen($base);$i++)$sum+=(int)$base[$i]*((strlen($base)-$i)%2?3:1);return $base.((10-$sum%10)%10);}
$product=new Product((int)($argv[1]??0));$variant=new Combination((int)($argv[2]??0));
nativeLabCheck(Validate::isLoadedObject($product)&&str_starts_with($product->reference,'QA-')&&Validate::isLoadedObject($variant)&&str_starts_with($variant->reference,'QA-'),'Only disposable native QA fixtures may be used.');
$codes=[];foreach(['product'=>$product,'variant'=>$variant] as $kind=>$record){$base=str_pad((string)$record->id,9,'0',STR_PAD_LEFT);
 $record->ean13=searchBarcode(($kind==='product'?'200':'201').$base);$record->upc=searchBarcode(($kind==='product'?'20':'21').$base);$record->isbn=searchBarcode('978'.$base);
 nativeLabCheck($record->update(),'Cannot save synthetic identifiers.');$codes[$kind]=['ean13'=>$record->ean13,'upc'=>$record->upc,'isbn'=>$record->isbn,'reference'=>$record->reference];}
$codes['product']['name']=$product->name[(int)$context->language->id];
echo json_encode($codes,JSON_THROW_ON_ERROR)."\n";
