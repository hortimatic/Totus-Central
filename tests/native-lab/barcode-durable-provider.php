<?php
/** Own QA products only; existing disposable lab, no HTTP authorization claim. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
foreach(['Protocol','JournalSchema','PdoJournal','PdoNativeEffect','NativeEffectHandler'] as $class)require_once $nativeRoot.'/modules/totuscentralconnector/src/'.$class.'.php';
require_once $nativeRoot.'/modules/totuscentralconnector/src/NativeBarcodes.php';
require_once $nativeRoot.'/modules/totuscentralconnector/src/NativeBarcodeIntents.php';
require_once $nativeRoot.'/modules/totuscentralconnector/src/NativeBarcodeEffect.php';
require_once $nativeRoot.'/modules/totuscentralconnector/src/CommandRunner.php';
use TotusCentralConnector\{Protocol,JournalSchema,PdoJournal,PdoNativeEffect,NativeEffectHandler,NativeBarcodes,NativeBarcodeIntents,NativeBarcodeEffect,CommandRunner};
$native=Db::getInstance()->getLink();nativeLabCheck($native instanceof PDO,'PDO required');nativeLabKernel();
$context->employee=new Employee(1);nativeLabCheck(Validate::isLoadedObject($context->employee),'Fixture employee required');
$run=bin2hex(random_bytes(5));$lang=(int)$context->language->id;
$make=static function(string $suffix)use($run,$lang){$p=new Product();$p->name=[$lang=>'QA Barcode '.$run.' '.$suffix];$p->link_rewrite=[$lang=>'qa-barcode-'.$run.'-'.$suffix];$p->reference='QA-BC-'.$run.'-'.$suffix;$p->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$p->price='7.250000';$p->wholesale_price='2.100000';$p->active=true;$p->available_for_order=true;$p->minimal_quantity=1;nativeLabCheck($p->add(),'Create QA barcode product');StockAvailable::setQuantity((int)$p->id,0,7,1);return $p;};
$simple=$make('simple');$parent=$make('variants');$collision=$make('collision');$changed=$make('changed');
$variants=[];foreach([0,1] as $index){$c=new Combination();$c->id_product=(int)$parent->id;$c->reference='QA-BC-'.$run.'-V'.$index;$c->price=$index;$c->minimal_quantity=1;$c->default_on=$index===0?1:null;nativeLabCheck($c->add(),'Create QA combination');StockAvailable::setQuantity((int)$parent->id,(int)$c->id,9,1);$variants[]=$c;}
Product::updateDefaultAttribute((int)$parent->id);Cache::clean('*');
// A distinct native shop owns the collision; collision scan must cross shops.
$shop=new Shop();$shop->name='QA Barcode '.$run;$shop->id_shop_group=1;$shop->id_category=(int)Configuration::get('PS_HOME_CATEGORY');$shop->theme_name='classic';$shop->active=false;nativeLabCheck($shop->add(),'Create QA native shop');
Shop::setContext(Shop::CONTEXT_SHOP,(int)$shop->id);$context->shop=$shop;$foreign=$make('foreign');Shop::setContext(Shop::CONTEXT_SHOP,1);$context->shop=new Shop(1);
$foreign->upc=NativeBarcodes::candidate('upc',(int)$parent->id,(int)$variants[0]->id);$foreign->setFieldsToUpdate(['upc'=>true]);nativeLabCheck($foreign->update(),'Set cross-shop UPC alias');Cache::clean('*');
$parameters=(require $nativeRoot.'/app/config/parameters.php')['parameters'];$dispatch=new PDO('mysql:host=127.0.0.1;port=3318;dbname=totus_tpv_lab;charset=utf8mb4',$parameters['database_user'],$parameters['database_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$it='tpv_bc_i_'.$run;$jt='tpv_bc_j_'.$run;$et='tpv_bc_e_'.$run;$scope=['installation_id'=>'00000000-0000-4000-8000-000000000001','actor_id'=>'00000000-0000-4000-8000-000000000001','shop_id'=>1,'api_account_id'=>17];
$selection=[['product_id'=>(int)$simple->id,'attribute_id'=>0],...array_map(static fn($c)=>['product_id'=>(int)$parent->id,'attribute_id'=>(int)$c->id],$variants)];

$next=1;$command=static function($plan,int $index=0)use($scope,&$next){$payload=array_intersect_key($plan,array_flip(['plan_version','field','items','plan_fingerprint']));$payload['item_index']=$index;$command=$scope+['protocol'=>1,'operation_id'=>'00000000-0000-4000-8000-'.str_pad((string)($next++),12,'0',STR_PAD_LEFT),'command'=>'barcodes.assign','payload'=>$payload,'fingerprint'=>''];unset($command['fingerprint']);$command['fingerprint']=hash('sha256',Protocol::canonical($command));return $command;};
try{
 $dispatch->exec(JournalSchema::mysql($jt));$dispatch->exec(NativeBarcodeIntents::mysqlSchema($it));$intents=new NativeBarcodeIntents($dispatch,$it);$journal=new PdoJournal($dispatch,$jt,$scope['installation_id']);$provider=new NativeBarcodes($native,$lang);
 $handler=new NativeBarcodeEffect($native,$journal,$intents,$provider,static fn()=>Db::getInstance()->getLink());$runner=new CommandRunner($journal,['barcodes.assign'=>$handler]);
 $plan=$provider->plan($scope,'ean13',50,$selection);nativeLabCheck($plan['capability']['can_execute']===true,'Installed after-hook capability unavailable');nativeLabCheck(count($plan['items'])===3,'Missing plan targets');
 // A durable dispatch and a verified native write, followed by a lost result.
 $cmd=$command($plan);$claim=$journal->claim($cmd);$receipt=$handler->execute($cmd,['claim_token'=>$claim['token']]);
 nativeLabCheck($receipt['count']===1&&$receipt['item_index']===0,'Single target write required');nativeLabCheck($journal->claim($cmd)['won']===false,'Lost reply allowed replay');
 Cache::clean('*');nativeLabCheck((new Product((int)$simple->id))->ean13===$plan['items'][0]['code'],'Simple native code missing');
 foreach($variants as $variant)nativeLabCheck((new Combination((int)$variant->id))->ean13==='','Unstarted target changed');
 $recovered=$runner->execute($cmd);nativeLabCheck(Protocol::canonical($receipt)===Protocol::canonical($recovered),'Read-only recovery changed result');nativeLabCheck($journal->claim($cmd)['status']==='completed','Recovered journal not completed');
 // Resume the remaining targets as separate, never-before-dispatched commands.
 foreach([1,2] as $index){$child=$command($plan,$index);$result=$runner->execute($child);nativeLabCheck(($result['verified']??false)===true&&$result['item_index']===$index,'Variant target failed');nativeLabCheck(Protocol::canonical($runner->execute($child))===Protocol::canonical($result),'Duplicate target changed result');}
 Cache::clean('*');$observed=new Product((int)$simple->id,false,null,1);nativeLabCheck($observed->reference===$simple->reference&&(string)$observed->price==='7.250000'&&(string)$observed->wholesale_price==='2.100000'&&StockAvailable::getQuantityAvailableByProduct((int)$simple->id,0,1)===7,'Simple price/reference/stock changed');
 nativeLabCheck($plan['items'][1]['code']!==NativeBarcodes::candidate('ean13',(int)$parent->id,(int)$variants[0]->id),'Cross-shop UPC alias collision ignored');
 foreach($variants as $variant){$read=new Combination((int)$variant->id,null,1);nativeLabCheck($read->ean13!==''&&$read->reference===$variant->reference&&StockAvailable::getQuantityAvailableByProduct((int)$parent->id,(int)$variant->id,1)===9,'Variant fields or stock changed');}
 $pending=$provider->plan($scope,'ean13',50,[['product_id'=>(int)$changed->id,'attribute_id'=>0]]);$changed->ean13='4006381333931';$changed->setFieldsToUpdate(['ean13'=>true]);nativeLabCheck($changed->update(),'Fixture concurrent code');$refused=$runner->execute($command($pending));Cache::clean('*');nativeLabCheck($refused['status']==='uncertain'&&(new Product((int)$changed->id))->ean13==='4006381333931','Existing code was overwritten');
 // Failure AFTER the native SQL and cache invalidation committed: no rollback
 // claim and no second Product::update during reconciliation.
 $crash=$make('lost-after-commit');$crashPlan=$provider->plan($scope,'ean13',50,[['product_id'=>(int)$crash->id,'attribute_id'=>0]]);
 $inner=new class($provider,$native){public int $writes=0;public bool $committed=false;private $provider;private $db;
  public function __construct($provider,$db){$this->provider=$provider;$this->db=$db;}
  public function validateCommand(array $command): void{$this->provider->validateCommand($command);}
  public function execute(array $command): array{$this->writes++;$result=$this->provider->execute($command);$this->committed=!$this->db->inTransaction();throw new RuntimeException('QA_LOST_AFTER_NATIVE_COMMIT');}
  public function verify(array $result,array $command): array{return $this->provider->verify($result,$command);}
  public function reconcile(array $command,array $claim): ?array{return $this->provider->reconcile($command,$claim);}
 };
 $lostHandler=new NativeBarcodeEffect($native,$journal,$intents,$inner,static fn()=>Db::getInstance()->getLink());$lostRunner=new CommandRunner($journal,['barcodes.assign'=>$lostHandler]);$lost=$command($crashPlan);
 nativeLabCheck($lostRunner->execute($lost)['status']==='uncertain'&&$inner->writes===1&&$inner->committed,'After-hook commit was not exercised');
 nativeLabCheck(($lostRunner->execute($lost)['verified']??false)===true&&$inner->writes===1,'After-commit recovery replayed update');
 // A live owner's native lock makes recovery wait, even if target SQL exists.
 $lock='totus:barcode:'.substr(hash('sha256',$scope['installation_id']),0,40);$locking=$dispatch->prepare('SELECT GET_LOCK(?,0)');$locking->execute([$lock]);nativeLabCheck((int)$locking->fetchColumn()===1,'Fixture peer lock');
 try{nativeLabCheck($handler->reconcile($cmd,[])===null,'Recovery ignored live owner lock');}finally{$locking=$dispatch->prepare('SELECT RELEASE_LOCK(?)');$locking->execute([$lock]);}
 // Ordinary selling/catalogue work can continue after a code plan is read.
 // The barcode intention binds identity/storage, not an obsolete stock/price.
 $live=$make('live-catalogue');$livePlan=$provider->plan($scope,'ean13',50,[['product_id'=>(int)$live->id,'attribute_id'=>0]]);
 $live->price='8.350000';$live->setFieldsToUpdate(['price'=>true]);nativeLabCheck($live->update(),'Fixture later price edit');StockAvailable::setQuantity((int)$live->id,0,12,1);
 $liveResult=$runner->execute($command($livePlan));Cache::clean('*');nativeLabCheck(($liveResult['verified']??false)===true&&(string)(new Product((int)$live->id))->price==='8.350000'&&StockAvailable::getQuantityAvailableByProduct((int)$live->id,0,1)===12,'Code generation blocked or overwrote legitimate price/stock changes');
 // Exercise Reference through both original ObjectModel update paths too.
 $referenceProduct=$make('reference-field');$referenceProduct->reference='';$referenceProduct->setFieldsToUpdate(['reference'=>true]);nativeLabCheck($referenceProduct->update(),'Clear own reference fixture');
 $referenceVariant=new Combination((int)$variants[0]->id);$referenceVariant->reference='';$referenceVariant->setFieldsToUpdate(['reference'=>true]);nativeLabCheck($referenceVariant->update(),'Clear own variant reference fixture');Cache::clean('*');
 $referencePlan=$provider->plan($scope,'reference',50,[['product_id'=>(int)$referenceProduct->id,'attribute_id'=>0],['product_id'=>(int)$parent->id,'attribute_id'=>(int)$referenceVariant->id]]);
 nativeLabCheck(count($referencePlan['items'])===2&&$referencePlan['capability']['can_execute'],'Reference field plan unavailable');
 foreach($referencePlan['items'] as $index=>$planned){$result=$runner->execute($command($referencePlan,$index));$entity=$planned['attribute_id']?new Combination($planned['attribute_id']):new Product($planned['product_id']);nativeLabCheck(($result['verified']??false)===true&&$entity->reference===$planned['code'],'Native reference assignment failed');}
 nativeLabCheck((string)(new Product((int)$referenceProduct->id))->price==='7.250000'&&StockAvailable::getQuantityAvailableByProduct((int)$referenceProduct->id,0,1)===7,'Reference assignment changed price or stock');
 // Enough independent eligible targets to exercise more than one read page on
 // a freshly installed disposable lab, without relying on earlier test data.
 for($i=0;$i<60;$i++)$make('scan-'.str_pad((string)$i,2,'0',STR_PAD_LEFT));
 echo json_encode(['pass'=>true,'checks'=>['native-simple-with-facetedsearch-after-hook','one-target-per-claim','lost-result-read-only-recovery','unstarted-targets-unchanged','resume-unstarted-targets','duplicate-commands-no-replay','cross-shop-upc-alias-collision','price-reference-stock-preserved','concurrent-code-preserved','failure-after-native-commit-recovered-without-update','live-owner-lock-blocks-reconciliation','later-price-stock-edits-preserved'],'native_implementation'=>'Product::update and Combination::update; hooks enabled'],JSON_THROW_ON_ERROR)."\n";
}finally{if($native->inTransaction())$native->rollBack();$dispatch->exec('DROP TABLE IF EXISTS '.chr(96).$jt.chr(96));$dispatch->exec('DROP TABLE IF EXISTS '.chr(96).$it.chr(96));}
