<?php
/** Later legitimate code edit, restricted to the current own QA HTTP product. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,32,JSON_THROW_ON_ERROR);
$id=(int)($argv[1]??0);$expected=(string)($argv[2]??'');$replacement=(string)($argv[3]??'');$p=new Product($id);
nativeLabCheck(($fixture['mode']??null)==='local-native-fixture'&&$id===(int)$fixture['productId']&&Validate::isLoadedObject($p)&&str_starts_with($p->reference,'QA-'),'Only current QA product may change');
nativeLabCheck($p->ean13===$expected&&preg_match('/^\d{13}$/D',$replacement)===1&&Validate::isEan13($replacement),'Current code or replacement is invalid');
$before=['price'=>(string)$p->price,'reference'=>$p->reference,'stock'=>(int)StockAvailable::getQuantityAvailableByProduct($id,0,1)];
$p->ean13=$replacement;$p->setFieldsToUpdate(['ean13'=>true]);nativeLabCheck($p->update(),'Cannot change current QA code');Cache::clean('*');$read=new Product($id);
nativeLabCheck($read->ean13===$replacement&&$before===['price'=>(string)$read->price,'reference'=>$read->reference,'stock'=>(int)StockAvailable::getQuantityAvailableByProduct($id,0,1)],'Code edit changed unrelated values');
echo json_encode(['before'=>$expected,'after'=>$read->ean13],JSON_THROW_ON_ERROR)."\n";
