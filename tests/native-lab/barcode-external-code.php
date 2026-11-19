<?php
/** A concurrent catalogue editor, restricted to own disposable QA entities. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
$productId=(int)($argv[1]??0);$attributeId=(int)($argv[2]??0);$code=(string)($argv[3]??'');
$parent=new Product($productId);nativeLabCheck(Validate::isLoadedObject($parent)&&str_starts_with($parent->reference,'QA-'),'Only a fictional QA product may change');
nativeLabCheck(preg_match('/^\d{13}$/D',$code)===1&&Validate::isEan13($code),'Valid fixture EAN13 required');
$entity=$attributeId?new Combination($attributeId):$parent;
nativeLabCheck(Validate::isLoadedObject($entity)&&(!$attributeId||(int)$entity->id_product===$productId)&&$entity->ean13==='','Only an empty code on the selected own QA target may change');
$before=['price'=>(string)$entity->price,'reference'=>$entity->reference];$entity->ean13=$code;$entity->setFieldsToUpdate(['ean13'=>true]);nativeLabCheck($entity->update(),'Cannot set external QA code');Cache::clean('*');
$after=$attributeId?new Combination($attributeId):new Product($productId);nativeLabCheck($after->ean13===$code&&$before===['price'=>(string)$after->price,'reference'=>$after->reference],'Concurrent edit changed unrelated values');
echo json_encode(['productId'=>$productId,'attributeId'=>$attributeId,'code'=>$after->ean13],JSON_THROW_ON_ERROR)."\n";
