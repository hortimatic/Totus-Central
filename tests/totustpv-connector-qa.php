<?php
require __DIR__ . '/../connectors/prestashop/src/Protocol.php';
require __DIR__ . '/../connectors/prestashop/src/CommandRunner.php';
use TotusCentralConnector\Protocol;
use TotusCentralConnector\CommandRunner;
$checks = 0;
function check($condition): void {global $checks;if (!$condition) {throw new RuntimeException('Assertion failed');}++$checks;}
function denied(callable $action): void {try {$action();} catch (InvalidArgumentException $error) {check(true);return;}throw new RuntimeException('Expected rejection');}
$uuid = '00000000-0000-4000-8000-000000000001';
$body = ['protocol'=>1,'operation_id'=>$uuid,'installation_id'=>$uuid,'shop_id'=>1,'actor_id'=>$uuid,
    'command'=>'cart.quote','payload'=>['cart_id'=>701,'expected_revision'=>1]];
$context = ['authenticated'=>true,'method'=>'POST','resource'=>'totus_tpv_quotes','api_account_id'=>17,
    'resource_methods'=>['GET','POST'],'installation_id'=>$uuid,'shop_id'=>1,'allowed_shop_ids'=>[1],
    'enabled_commands'=>['cart.quote']];
$command = Protocol::decode(json_encode($body),'totus_tpv_quotes',$context);
check(strlen($command['fingerprint']) === 64);
$reordered = $body;$reordered['payload']=['expected_revision'=>1,'cart_id'=>701];
check(Protocol::decode(json_encode($reordered),'totus_tpv_quotes',$context)['fingerprint'] === $command['fingerprint']);
foreach ([['authenticated'=>false],['method'=>'GET'],['resource_methods'=>['GET']],['api_account_id'=>0],
    ['installation_id'=>'another'],['shop_id'=>2],['allowed_shop_ids'=>[1,2]],['enabled_commands'=>[]]] as $patch) {
    denied(fn()=>Protocol::decode(json_encode($body),'totus_tpv_quotes',array_replace($context,$patch)));
}
foreach ([['protocol'=>2],['operation_id'=>'bad'],['shop_id'=>'1'],['command'=>'sale.commit'],
    ['extra'=>'forbidden'],['payload'=>['amount'=>8.01]],['payload'=>['nested'=>['cvv'=>'123']]]] as $patch) {
    denied(fn()=>Protocol::decode(json_encode(array_replace($body,$patch)),'totus_tpv_quotes',$context));
}
denied(fn()=>Protocol::decode(str_repeat('x',65537),'totus_tpv_quotes',$context));
$repository = new class {
    public array $rows=[];public int $effects=0;
    public function claim($command) {
        $id=$command['operation_id'];
        if (isset($this->rows[$id])) {return $this->rows[$id]+['won'=>false,'same_intent'=>$this->rows[$id]['hash']===$command['fingerprint']];}
        $this->rows[$id]=['status'=>'pending','hash'=>$command['fingerprint']];return ['won'=>true,'token'=>'native-durable-token'];
    }
    public function complete($command,$token,$result) {
        $this->rows[$command['operation_id']]=['status'=>'completed','hash'=>$command['fingerprint'],'result'=>$result];return $result;
    }
    public function uncertain($command,$token,$diagnostic) {
        $this->rows[$command['operation_id']]['status']='uncertain';return ['status'=>'uncertain','reason'=>$diagnostic['reason']];
    }
};
$handler = new class {
    public int $calls=0;public bool $loseResponse=false;public bool $effectExists=false;
    public function execute($command) {$this->calls++;$this->effectExists=true;if ($this->loseResponse) {throw new RuntimeException('Do not expose SQL or keys');}return ['verified'=>true,'native_reference'=>701];}
    public function reconcile($command,$claim) {return $this->effectExists?['verified'=>true,'native_reference'=>701]:null;}
};
$runner=new CommandRunner($repository,['cart.quote'=>$handler]);
check($runner->execute($command)['verified']===true);check($runner->execute($command)['verified']===true);check($handler->calls===1);
$conflict=$command;$conflict['fingerprint']=str_repeat('a',64);denied(fn()=>$runner->execute($conflict));
$next=$body;$next['operation_id']='00000000-0000-4000-8000-000000000002';
$next=Protocol::decode(json_encode($next),'totus_tpv_quotes',$context);$handler->loseResponse=true;
check($runner->execute($next)['reason']==='TOTUS_NATIVE_EXECUTION_FAILED');
check($runner->execute($next)['verified']===true);check($handler->calls===2);
$pending=$body;$pending['operation_id']='00000000-0000-4000-8000-000000000003';
$pending=Protocol::decode(json_encode($pending),'totus_tpv_quotes',$context);
$repository->claim($pending);$handler->effectExists=false;
check($runner->execute($pending)['retry_command_forbidden']===true);check($handler->calls===2);
echo "PASS Totus connector PHP: $checks assertions. Native handlers/storage simulated; no PrestaShop installation or writes.\n";
