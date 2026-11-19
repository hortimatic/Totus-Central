<?php
/** Simulate death after the owned native effect and before journal completion.
 * No route, test switch or retry permission is added to the real connector. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$context->employee=new Employee(1);$module=Module::getInstanceByName('totuscentralconnector');$profile=$module->nativeProfile();
$account=(int)($argv[1]??0);$key=new WebserviceKey($account);
nativeLabCheck(Validate::isLoadedObject($key)&&$key->description==='Disposable Totus native HTTP QA','Unexpected fixture API account');
$body=file_get_contents($project.'/artifacts/native-lab/barcode-lost-command.json');
$command=TotusCentralConnector\Protocol::decode($body,'totus_tpv_barcodes',['authenticated'=>true,'method'=>'POST','resource'=>'totus_tpv_barcodes','resource_methods'=>['POST'],'api_account_id'=>$account,'installation_id'=>$profile['installation_id'],'shop_id'=>1,'allowed_shop_ids'=>[1],'enabled_commands'=>['barcodes.assign']]);
$dispatch=TotusCentralConnector\NativeRuntime::connection();$native=Db::getInstance()->getLink();
$journal=new TotusCentralConnector\PdoJournal($dispatch,_DB_PREFIX_.'totus_tpv_journal',$profile['installation_id']);
$intents=new TotusCentralConnector\NativeBarcodeIntents($dispatch,_DB_PREFIX_.'totus_tpv_barcode_intents');
$provider=new TotusCentralConnector\NativeBarcodes($native,(int)$profile['language_id']);
$handler=new TotusCentralConnector\NativeBarcodeEffect($native,$journal,$intents,$provider,static fn()=>Db::getInstance()->getLink());
$claim=$journal->claim($command);nativeLabCheck($claim['won']===true,'Fixture command already dispatched');
$result=$handler->execute($command,['claim_token'=>$claim['token']]);
nativeLabCheck($journal->claim($command)['status']==='pending','Fixture must leave journal unfinished');
echo json_encode(['verified'=>true,'result'=>$result,'journal_status'=>'pending'],JSON_THROW_ON_ERROR)."\n";
