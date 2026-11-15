<?php
require __DIR__.'/bootstrap.php';
require $project.'/connectors/prestashop/src/Protocol.php';
require $project.'/connectors/prestashop/src/PdoJournal.php';
require $project.'/connectors/prestashop/src/JournalSchema.php';
use TotusCentralConnector\PdoJournal;
use TotusCentralConnector\JournalSchema;
use TotusCentralConnector\Protocol;
$parameters=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
$connect=static fn()=>new PDO('mysql:host=127.0.0.1;port=3318;dbname=totus_tpv_lab;charset=utf8mb4',
    $parameters['database_user'],$parameters['database_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$first=$connect();$second=$connect();$table='tpv_totus_lab_journal_'.bin2hex(random_bytes(6));
$installation='00000000-0000-4000-8000-000000000001';
$command=['operation_id'=>'00000000-0000-4000-8000-000000000002','installation_id'=>$installation,
    'actor_id'=>$installation,'api_account_id'=>17,'shop_id'=>1,'command'=>'sale.commit','fingerprint'=>str_repeat('a',64)];
try {
    $first->exec(JournalSchema::mysql($table));
    $journal=new PdoJournal($first,$table,$installation);$restarted=new PdoJournal($second,$table,$installation);
    $claim=$journal->claim($command);
    nativeLabCheck($claim['won']===true,'First native journal claim failed.');
    nativeLabCheck($restarted->claim($command)['won']===false,'Another connection acquired an existing dispatch.');
    $first->beginTransaction();$first->rollBack();
    nativeLabCheck($restarted->claim($command)['won']===false,'Unrelated rollback released the committed claim.');
    nativeLabCheck($restarted->claim(array_replace($command,['shop_id'=>2]))['same_intent']===false,'Another shop reused an operation.');
    nativeLabCheck($restarted->claim(array_replace($command,['actor_id'=>'00000000-0000-4000-8000-000000000009']))['same_intent']===false,'Another cashier reused an operation.');
    $journal->uncertain($command,$claim['token'],['reason'=>'TOTUS_RESPONSE_LOST','native_reference'=>701]);
    nativeLabCheck($restarted->claim($command)['status']==='uncertain','Uncertainty did not persist across connections.');
    $result=['verified'=>true,'native_reference'=>701,'data'=>['total_cents'=>801]];
    nativeLabCheck(Protocol::canonical($restarted->complete($command,null,$result))===Protocol::canonical($result),'Read-only recovery failed.');
    nativeLabCheck(Protocol::canonical($journal->claim($command)['result'])===Protocol::canonical($result),'Confirmed result changed after replay.');
    $other=array_replace($command,['operation_id'=>'00000000-0000-4000-8000-000000000003']);
    $otherClaim=$journal->claim($other);$duplicateRejected=false;
    try{$journal->complete($other,$otherClaim['token'],$result);}catch(PDOException $error){
        $duplicateRejected=$error->getCode()==='23000';
    }
    nativeLabCheck($duplicateRejected,'One native order was bound to two sales.');
    nativeLabCheck($journal->claim($other)['status']==='pending','Failed completion corrupted another dispatch.');
    echo "PASS actual MariaDB/InnoDB journal: independent connections, committed claims, recovery, scope and unique native order. Native order side-effect atomicity is not certified by this test.\n";
} finally {
    if($first->inTransaction())$first->rollBack();
    // Exact random table allocated by this test, in the bootstrap-verified local DB.
    $first->exec('DROP TABLE IF EXISTS `'.$table.'`');
}
