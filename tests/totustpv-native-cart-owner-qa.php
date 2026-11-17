<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeOwnedCarts.php';
require __DIR__.'/../connectors/prestashop/src/NativeSaleNote.php';
use TotusCentralConnector\NativeOwnedCarts;
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec('CREATE TABLE carts(operation_id TEXT,cart_id INTEGER,installation_id TEXT,api_account_id INTEGER,shop_id INTEGER,actor_id TEXT,session_id TEXT,drawer_id TEXT,customer_id INTEGER)');
$db->exec('CREATE TABLE journal(request_id TEXT,installation_id TEXT,api_account_id INTEGER,shop_id INTEGER,actor_id TEXT,command TEXT,fingerprint TEXT,status TEXT,result_json TEXT)');
$db->exec('CREATE TABLE effects(operation_id TEXT,installation_id TEXT,api_account_id INTEGER,shop_id INTEGER,actor_id TEXT,command TEXT,fingerprint TEXT,result_json TEXT)');
$command=['installation_id'=>'installation-fixture','api_account_id'=>17,'shop_id'=>1,'actor_id'=>'actor-fixture'];
$receipt=['verified'=>true,'native_reference'=>701,'cart_id'=>701,'session_id'=>'session-fixture','drawer_id'=>'drawer-fixture','allow_out_of_stock'=>true];
$db->exec("INSERT INTO carts VALUES ('operation-fixture',701,'installation-fixture',17,1,'actor-fixture','session-fixture','drawer-fixture',501)");
$insert=$db->prepare("INSERT INTO journal VALUES ('operation-fixture','installation-fixture',17,1,'actor-fixture','cart.prepare','fingerprint-fixture','pending',?)");$insert->execute([json_encode($receipt)]);
$owner=new NativeOwnedCarts($db,'carts','journal',['currency_id'=>1,'language_id'=>1,'carrier_id'=>5],'effects');$checks=0;
$check=static function($value)use(&$checks){if(!$value)throw new RuntimeException('Cart owner assertion '.($checks+1));$checks++;};
$check($owner->owner(701,$command)['allow_out_of_stock']===false);
$insert=$db->prepare("INSERT INTO effects VALUES ('operation-fixture','installation-fixture',17,1,'actor-fixture','cart.prepare','fingerprint-fixture',?)");$insert->execute([json_encode($receipt)]);
$check($owner->owner(701,$command)['allow_out_of_stock']===true); // committed native effect, pending independent acknowledgement
foreach(['installation_id'=>"'foreign-installation'",'api_account_id'=>'18','shop_id'=>'2','actor_id'=>"'foreign-actor'",'command'=>"'sale.commit'",'fingerprint'=>"'foreign-fingerprint'"] as $column=>$other){
 $original=$db->query('SELECT '.$column.' FROM effects')->fetchColumn();$db->exec('UPDATE effects SET '.$column.'='.$other);
 $check($owner->owner(701,$command)['allow_out_of_stock']===false);$db->exec('UPDATE effects SET '.$column.'='.$db->quote((string)$original));
}
foreach(['verified'=>false,'cart_id'=>702,'session_id'=>'other-session','drawer_id'=>'other-drawer','allow_out_of_stock'=>'true'] as $key=>$value){
 $db->prepare('UPDATE effects SET result_json=?')->execute([json_encode([...$receipt,$key=>$value])]);$check($owner->owner(701,$command)['allow_out_of_stock']===false);
}
$db->prepare('UPDATE effects SET result_json=?')->execute([json_encode($receipt)]);$db->exec("UPDATE journal SET status='uncertain'");
$check($owner->owner(701,$command)['allow_out_of_stock']===true);
try{$owner->owner(701,[...$command,'actor_id'=>'foreign-actor']);throw new RuntimeException('Expected ownership refusal');}catch(InvalidArgumentException $error){$check(str_contains($error->getMessage(),'CART_OWNERSHIP_REQUIRED'));}
$db->exec('DELETE FROM effects');$db->exec("UPDATE journal SET status='completed'");$check($owner->owner(701,$command)['allow_out_of_stock']===false);
$legacy=new NativeOwnedCarts($db,'carts','journal',['currency_id'=>1,'language_id'=>1,'carrier_id'=>5]);$check($legacy->owner(701,$command)['allow_out_of_stock']===true);
$db->prepare('UPDATE effects SET result_json=?')->execute([json_encode($receipt)]);
$receipt['sale_note']='Nota privada del laboratorio';$db->exec("UPDATE journal SET status='uncertain'");
$db->prepare("INSERT INTO effects VALUES ('operation-fixture','installation-fixture',17,1,'actor-fixture','cart.prepare','fingerprint-fixture',?)")->execute([json_encode($receipt)]);
$check($owner->owner(701,$command)['sale_note']===$receipt['sale_note']);
foreach(['verified'=>false,'cart_id'=>702,'session_id'=>'other-session','drawer_id'=>'other-drawer'] as $key=>$value){$db->prepare('UPDATE effects SET result_json=?')->execute([json_encode([...$receipt,$key=>$value])]);$check(!isset($owner->owner(701,$command)['sale_note']));}
$db->prepare('UPDATE effects SET result_json=?')->execute([json_encode($receipt)]);$db->exec("UPDATE effects SET fingerprint='foreign'");$check(!isset($owner->owner(701,$command)['sale_note']));

echo "PASS native cart ownership: {$checks} SQLite assertions; committed scoped effects survive lost journal acknowledgement, foreign or altered receipts fail closed. No native order created.\n";
