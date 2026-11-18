<?php
require __DIR__.'/bootstrap.php';
$p=new Product((int)($argv[1]??0));$attribute=(int)($argv[2]??0);
nativeLabCheck(Validate::isLoadedObject($p)&&str_starts_with($p->reference,'QA-DISABLED-')&&$attribute>=0,'Only disabled-stock QA fixtures can be inspected.');
echo json_encode(['active'=>(bool)$p->active,'availableForOrder'=>(bool)$p->available_for_order,'stock'=>(int)StockAvailable::getQuantityAvailableByProduct((int)$p->id,$attribute,1)],JSON_THROW_ON_ERROR)."\n";
