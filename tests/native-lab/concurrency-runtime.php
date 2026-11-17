<?php
/** Test-only native CLI runtime. No HTTP listener, installation or remote shop. */
require_once __DIR__.'/bootstrap.php';
$context->employee=new Employee(1);nativeLabCheck(Validate::isLoadedObject($context->employee),'Missing seeded local fixture employee.');
nativeLabKernel();
foreach(['Protocol','CommandRunner','PdoJournal','JournalSchema','PdoNativeEffect','NativeEffectHandler','NativeCartQuote','NativeCustomers','NativeCartAdjustments','NativeLineAdjustments','NativeOwnedCarts','NativePaidPickup','NativeSale'] as $class)require_once nativeLabConnector($class);
use TotusCentralConnector\{Protocol,PdoJournal,PdoNativeEffect,NativeEffectHandler,CommandRunner,NativeOwnedCarts,NativeCartQuote,NativeSale};
class TotusConcurrencyPaymentFixture extends PaymentModule {
 public function __construct(){$this->name='totusconcurrencyfixture';$this->version='0.0.1';$this->author='Totus local concurrency test';parent::__construct();$this->active=true;}
}
function concurrencyDirectory(string $path): string {
 global $project;$directory=realpath($path);$prefix=str_replace('\\','/',$project).'/artifacts/totustpv-concurrency/';
 nativeLabCheck($directory!==false&&str_starts_with(str_replace('\\','/',$directory).'/', $prefix),'Only an owned concurrency artifact directory is allowed.');return $directory;
}
function concurrencyConfig(string $directory): array {
 $config=json_decode(file_get_contents($directory.'/manifest.json'),true,64,JSON_THROW_ON_ERROR);
 nativeLabCheck(($config['mode']??null)==='local-native-concurrency'&&($config['remoteShopTouched']??true)===false,'Unexpected concurrency manifest.');
 nativeLabCheck(preg_match('/^[a-f0-9]{12}$/D',$config['run']??'')===1,'Invalid concurrency run.');
 foreach(['journal','effects','carts'] as $key)nativeLabCheck(($config['tables'][$key]??null)==='tpv_conc_'.$config['run'].'_'.$key,'Foreign fixture table.');
 $p=new Product((int)$config['productId']);nativeLabCheck(Validate::isLoadedObject($p)&&$p->reference==='QA-CONC-'.$config['run'],'Foreign concurrency product.');return $config;
}
function concurrencyCommand(string $name,array $payload,array $base,string $id): array {
 $resource=['cart.prepare'=>'totus_tpv_carts','cart.quote'=>'totus_tpv_quotes','sale.commit'=>'totus_tpv_sales'][$name];
 return Protocol::decode(json_encode([...$base,'operation_id'=>$id,'command'=>$name,'payload'=>$payload],JSON_THROW_ON_ERROR),$resource,
  ['authenticated'=>true,'method'=>'POST','resource'=>$resource,'resource_methods'=>['POST'],'api_account_id'=>17,'installation_id'=>$base['installation_id'],'shop_id'=>1,'allowed_shop_ids'=>[1],'enabled_commands'=>['cart.prepare','cart.quote','sale.commit']]);
}
function concurrencyRuntime(array $config,string $directory,string $phase='setup',int $slot=0): array {
 global $nativeRoot;$native=Db::getInstance()->getLink();$parameters=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
 $journalDb=new PDO('mysql:host=127.0.0.1;port=3318;dbname=totus_tpv_lab;charset=utf8mb4',$parameters['database_user'],$parameters['database_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
 $journal=new PdoJournal($journalDb,$config['tables']['journal'],$config['installationId']);
 $effects=new PdoNativeEffect($native,$config['tables']['effects'],$journal,static fn()=>Db::getInstance()->getLink());
 $carts=new NativeOwnedCarts($native,$config['tables']['carts'],$config['tables']['journal'],$config['profile'],$config['tables']['effects']);
 $quote=new NativeCartQuote([$carts,'owner'],new PrestaShop\PrestaShop\Adapter\ContextStateManager(new PrestaShop\PrestaShop\Adapter\LegacyContext()));
 $sale=new NativeSale([$carts,'quote'],[$carts,'owner'],new TotusConcurrencyPaymentFixture(),$config['profile']);
 $barrier=new class($sale,$directory,$phase,$slot){
  private $sale;private string $directory;private string $phase;private int $slot;
  public function __construct($sale,$directory,$phase,$slot){$this->sale=$sale;$this->directory=$directory;$this->phase=$phase;$this->slot=$slot;}
  public function execute(array $command): array {
   file_put_contents($this->directory.'/attempts-'.$this->slot.'.jsonl',json_encode(['pid'=>getmypid(),'operationId'=>$command['operation_id'],'phase'=>$this->phase,'at'=>microtime(true)],JSON_THROW_ON_ERROR)."\n",FILE_APPEND|LOCK_EX);
   if($this->phase==='race'){
    nativeLabCheck(Db::getInstance()->getLink()->inTransaction(),'Barrier must be inside the native transaction.');
    file_put_contents($this->directory.'/ready-'.$this->slot.'.json',json_encode(['pid'=>getmypid(),'transaction'=>true],JSON_THROW_ON_ERROR));
    $deadline=microtime(true)+45;while(!is_file($this->directory.'/release')){if(microtime(true)>$deadline)throw new RuntimeException('TOTUS_FIXTURE_BARRIER_TIMEOUT');usleep(2000);}
   }
   $started=microtime(true);try{return $this->sale->execute($command);}finally{file_put_contents($this->directory.'/interval-'.$this->slot.'-'.$this->phase.'.json',json_encode(['pid'=>getmypid(),'started'=>$started,'finished'=>microtime(true)],JSON_THROW_ON_ERROR));}
  }
  public function reconcile(array $command,array $claim): ?array{return $this->sale->reconcile($command,$claim);}
 };
 return ['native'=>$native,'journal'=>$journal,'effects'=>$effects,'sale'=>$sale,'runner'=>new CommandRunner($journal,['cart.prepare'=>new NativeEffectHandler($effects,$carts),'cart.quote'=>new NativeEffectHandler($effects,$quote),'sale.commit'=>new NativeEffectHandler($effects,$barrier)])];
}
