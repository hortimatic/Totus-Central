<?php
foreach(['Protocol','CommandRunner','PdoJournal','PdoNativeEffect','NativeEffectHandler'] as $name)
    require __DIR__.'/../connectors/prestashop/src/'.$name.'.php';
use TotusCentralConnector\CommandRunner;
use TotusCentralConnector\PdoJournal;
use TotusCentralConnector\PdoNativeEffect;
use TotusCentralConnector\NativeEffectHandler;
$checks=0;
function check($value): void{global $checks;if(!$value)throw new RuntimeException('Assertion failed');++$checks;}
$file=tempnam(sys_get_temp_dir(),'totus-effect-');
try{
    $native=new PDO('sqlite:'.$file);$dispatchDb=new PDO('sqlite:'.$file);
    $native->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
    $native->exec('CREATE TABLE journal(request_id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,
      api_account_id INTEGER NOT NULL,shop_id INTEGER NOT NULL,actor_id TEXT NOT NULL,command TEXT NOT NULL,
      fingerprint TEXT NOT NULL,status TEXT NOT NULL,claim_token TEXT NOT NULL,native_reference TEXT,
      native_order_id INTEGER,result_json TEXT,error_code TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(installation_id,shop_id,native_order_id))');
    $native->exec('CREATE TABLE effects(operation_id TEXT PRIMARY KEY,installation_id TEXT NOT NULL,
      api_account_id INTEGER NOT NULL,shop_id INTEGER NOT NULL,actor_id TEXT NOT NULL,command TEXT NOT NULL,
      fingerprint TEXT NOT NULL,result_json TEXT NOT NULL)');
    $native->exec('CREATE TABLE business(id INTEGER PRIMARY KEY AUTOINCREMENT,operation_id TEXT UNIQUE NOT NULL)');
    $uuid='00000000-0000-4000-8000-000000000001';
    $journal=new PdoJournal($dispatchDb,'journal',$uuid);
    $repository=new class($journal){
        public bool $loseCompletion=false;private $journal;
        public function __construct($journal){$this->journal=$journal;}
        public function claim($command){return $this->journal->claim($command);}
        public function complete($command,$token,$result){
            if($this->loseCompletion){$this->loseCompletion=false;throw new RuntimeException('Simulated storage response loss');}
            return $this->journal->complete($command,$token,$result);
        }
        public function uncertain($command,$token,$reason){return $this->journal->uncertain($command,$token,$reason);}
    };
    $effects=new PdoNativeEffect($native,'effects',$journal,static fn()=>$native);
    $inner=new class($native){
        public bool $fail=false;public bool $interrupt=false;public bool $wrongReadback=false;public bool $wrongAmount=false;public int $calls=0;private $db;
        public function __construct($db){$this->db=$db;}
        public function execute($command){
            ++$this->calls;$statement=$this->db->prepare('INSERT INTO business(operation_id) VALUES (?)');$statement->execute([$command['operation_id']]);
            $id=(int)$this->db->lastInsertId();
            if($this->interrupt)$this->db->commit();
            if($this->fail)throw new RuntimeException('TOTUS_INJECTED_AFTER_EFFECT');
            return ['verified'=>true,'native_reference'=>$id,'total_cents'=>801];
        }
        public function reconcile($command,$claim){
            $statement=$this->db->prepare('SELECT id FROM business WHERE operation_id=?');$statement->execute([$command['operation_id']]);$id=$statement->fetchColumn();
            return $id===false?null:['verified'=>true,'native_reference'=>(int)$id+($this->wrongReadback?100:0),'total_cents'=>$this->wrongAmount?800:801];
        }
    };
    $handler=new NativeEffectHandler($effects,$inner);$runner=new CommandRunner($repository,['sale.commit'=>$handler]);
    $make=static fn($n)=>['operation_id'=>sprintf('00000000-0000-4000-8000-%012d',$n),'installation_id'=>$uuid,
      'actor_id'=>$uuid,'api_account_id'=>17,'shop_id'=>1,'command'=>'sale.commit','fingerprint'=>str_repeat(dechex($n),64)];
    $first=$make(1);check($runner->execute($first)['verified']===true);check($runner->execute($first)['verified']===true);check($inner->calls===1);
    $inner->fail=true;$failed=$make(2);
    check($runner->execute($failed)['status']==='uncertain');check((int)$native->query('SELECT COUNT(*) FROM business')->fetchColumn()===1);
    check($effects->receipt($failed)===null);check($runner->execute($failed)['retry_command_forbidden']===true);check($inner->calls===2);
    $inner->fail=false;$lost=$make(3);$repository->loseCompletion=true;
    check($runner->execute($lost)['status']==='uncertain');check($effects->receipt($lost)['verified']===true);
    $inner->wrongReadback=true;check($runner->execute($lost)['status']==='uncertain');check($inner->calls===3);
    $inner->wrongReadback=false;$inner->wrongAmount=true;check($runner->execute($lost)['status']==='uncertain');check($inner->calls===3);
    $inner->wrongAmount=false;check($runner->execute($lost)['verified']===true);check($inner->calls===3);
    $inner->interrupt=true;$interrupted=$make(4);
    check($runner->execute($interrupted)['status']==='uncertain');check($effects->receipt($interrupted)===null);
    check($runner->execute($interrupted)['status']==='uncertain');check($inner->calls===4);
    $called=false;$denied=false;
    try{$effects->run($make(5),'wrong-token',function()use(&$called){$called=true;return ['verified'=>true];});}
    catch(InvalidArgumentException $error){$denied=true;}
    check($denied&&!$called);
    echo "PASS native effect coordinator: $checks assertions with real SQLite transactions and injected failures; business handler is simulated, not PrestaShop.\n";
}finally{
    unset($runner,$handler,$inner,$effects,$repository,$journal,$native,$dispatchDb);
    if(is_file($file))unlink($file);
}
