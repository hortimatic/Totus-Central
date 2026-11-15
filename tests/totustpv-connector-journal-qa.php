<?php
require __DIR__ . '/../connectors/prestashop/src/Protocol.php';
require __DIR__ . '/../connectors/prestashop/src/PdoJournal.php';
use TotusCentralConnector\Protocol;
use TotusCentralConnector\PdoJournal;
$checks=0;
function check($condition): void {global $checks;if (!$condition) {throw new RuntimeException('Assertion failed');}++$checks;}
function denied(callable $action): void {try {$action();}catch (Throwable $error){check(true);return;}throw new RuntimeException('Expected rejection');}
$file=tempnam(sys_get_temp_dir(),'totus-journal-');
$uuid='00000000-0000-4000-8000-000000000001';
$command=['operation_id'=>$uuid,'installation_id'=>$uuid,'actor_id'=>$uuid,'api_account_id'=>17,
 'shop_id'=>1,'command'=>'cart.quote','fingerprint'=>str_repeat('a',64)];
try {
 $db=new PDO('sqlite:'.$file);$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
 $db->exec('CREATE TABLE journal(request_id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,
  api_account_id INTEGER NOT NULL,shop_id INTEGER NOT NULL,actor_id TEXT NOT NULL,command TEXT NOT NULL,
  fingerprint TEXT NOT NULL,status TEXT NOT NULL,claim_token TEXT NOT NULL,native_reference TEXT,
  native_order_id INTEGER,result_json TEXT,error_code TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(installation_id,shop_id,native_order_id))');
 $journal=new PdoJournal($db,'journal',$uuid);
 $claim=$journal->claim($command);check($claim['won']===true);check(strlen($claim['token'])===64);
 check($journal->claim($command)['won']===false);
 foreach ([['fingerprint'=>str_repeat('b',64)],['shop_id'=>2],['api_account_id'=>18],['actor_id'=>'00000000-0000-4000-8000-000000000009'],['command'=>'sale.commit']] as $patch) {
  check($journal->claim(array_replace($command,$patch))['same_intent']===false);
 }
 // A new connection/process sees the pending dispatch instead of executing it.
 $second=new PDO('sqlite:'.$file);$restarted=new PdoJournal($second,'journal',$uuid);
 check($restarted->claim($command)['won']===false);
 check($journal->uncertain($command,$claim['token'],['reason'=>'TOTUS_RESPONSE_LOST','native_reference'=>701])['status']==='uncertain');
 denied(fn()=>$journal->complete($command,'wrong-token',['verified'=>true,'native_reference'=>701]));
 denied(fn()=>$journal->complete($command,$claim['token'],['verified'=>false,'native_reference'=>701]));
 denied(fn()=>$journal->complete($command,$claim['token'],['verified'=>true,'native_reference'=>702]));
 $result=['verified'=>true,'native_reference'=>701,'data'=>['total_minor'=>801]];
 check($restarted->complete($command,null,$result)==$result);
 check($journal->claim($command)['result']==$result);
 check($journal->uncertain($command,$claim['token'],['reason'=>'TOTUS_LATE_TIMEOUT'])==$result);
 $sale=array_replace($command,['operation_id'=>'00000000-0000-4000-8000-000000000002','command'=>'sale.commit']);
 $s=$journal->claim($sale);$journal->complete($sale,$s['token'],['verified'=>true,'native_reference'=>901]);
 $other=array_replace($sale,['operation_id'=>'00000000-0000-4000-8000-000000000003']);
 $s2=$journal->claim($other);
 denied(fn()=>$journal->complete($other,$s2['token'],['verified'=>true,'native_reference'=>901]));
 check($journal->claim($other)['status']==='pending');
 $db->beginTransaction();denied(fn()=>$journal->claim($command));$db->rollBack();
 denied(fn()=>new PdoJournal($db,'journal;DROP TABLE journal',$uuid));
 echo "PASS connector journal PHP: $checks assertions on persistent SQLite/PDO, restart and unique constraints. MySQL/native PrestaShop not verified by this test.\n";
} finally {
 unset($journal,$restarted,$db,$second);
 if (is_file($file)) {unlink($file);}
}
