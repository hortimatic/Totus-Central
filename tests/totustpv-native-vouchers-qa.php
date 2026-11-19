<?php
require __DIR__.'/native-lab/document-rounding.php';
use TotusCentralConnector\NativeDocuments;
$rules=[['name'=>'Vale histórico','value'=>'1.000000'],['name'=>'Descuento','value'=>'2.000000']];
$result=NativeDocuments::voucherSnapshot($rules,300,2);
if(!$result['vouchers_complete']||array_column($result['vouchers'],'amount_cents')!==[100,200])throw new RuntimeException('Historical values lost');
foreach([false,[['name'=>'Bad','value'=>'invalid']],$rules] as $rows){
 if(NativeDocuments::voucherSnapshot($rows,301,2)['vouchers_complete'])throw new RuntimeException('Invalid breakdown accepted');
}
if(!NativeDocuments::voucherSnapshot([],0,2)['vouchers_complete'])throw new RuntimeException('Zero discount rejected');
$rules[]=['name'=>'Deleted','value'=>'9.00','deleted'=>1];
if(!NativeDocuments::voucherSnapshot($rules,300,2)['vouchers_complete'])throw new RuntimeException('Deleted voucher counted');
echo 'PASS historical vouchers, deleted rules, malformed and inconsistent breakdowns.'.PHP_EOL;
