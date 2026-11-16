<?php
/** Failure injection after native credit note and restock, disposable DB only. */
require __DIR__.'/bootstrap.php';
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$module=Module::getInstanceByName('totuscentralconnector');$profile=$module->nativeProfile();
use TotusCentralConnector\{Protocol,NativeRuntime,NativeReturns,PdoJournal,PdoNativeEffect};
$saleId=$argv[1]??'';nativeLabCheck(Protocol::uuid($saleId),'Fixture sale ID required.');
$db=Db::getInstance()->getLink();$s=$db->prepare('SELECT * FROM `'._DB_PREFIX_.'totus_tpv_journal` WHERE request_id=?');
$s->execute([$saleId]);$sale=$s->fetch(PDO::FETCH_ASSOC);nativeLabCheck($sale&&$sale['command']==='sale.commit','Fixture sale missing.');
$scope=['installation_id'=>$profile['installation_id'],'shop_id'=>1,'api_account_id'=>(int)$sale['api_account_id'],'actor_id'=>$sale['actor_id']];
$returns=new NativeReturns($db,$module,$profile,NativeRuntime::refundServices());$available=$returns->available($saleId,$scope);
$id=vsprintf('%s%s-%s-%s-%s-%s%s%s',str_split(bin2hex(random_bytes(16)),4));
$command=array_merge($scope,['protocol'=>1,'operation_id'=>$id,'command'=>'return.commit','payload'=>[
    'sale_operation_id'=>$saleId,'state_fingerprint'=>$available['state_fingerprint'],
    'items'=>[['detail_id'=>$available['items'][0]['detail_id'],'quantity'=>1,'restock'=>true]],
    'payments'=>[['method'=>'cash','amount_cents'=>801]],'operator_confirmed'=>true,
]]);$command['fingerprint']=hash('sha256',Protocol::canonical($command));
$journal=new PdoJournal(NativeRuntime::connection(),_DB_PREFIX_.'totus_tpv_journal',$profile['installation_id']);
$effects=new PdoNativeEffect($db,_DB_PREFIX_.'totus_tpv_effects',$journal,static fn()=>Db::getInstance()->getLink());
$snapshot=static function()use($db){
    $result=[];foreach(['order_slip','order_slip_detail','stock_mvt','totus_tpv_returns','totus_tpv_effects'] as $table)
        $result[$table]=$db->query('SELECT COUNT(*) FROM `'._DB_PREFIX_.$table.'`')->fetchColumn();
    $result['stock']=$db->query('SELECT id_stock_available,quantity,physical_quantity FROM `'._DB_PREFIX_.'stock_available` ORDER BY id_stock_available')->fetchAll(PDO::FETCH_ASSOC);
    $result['details']=$db->query('SELECT id_order_detail,product_quantity_refunded,product_quantity_return,product_quantity_reinjected FROM `'._DB_PREFIX_.'order_detail` ORDER BY id_order_detail')->fetchAll(PDO::FETCH_ASSOC);
    return $result;
};
$before=$snapshot();$claim=$journal->claim($command);nativeLabCheck($claim['won']===true,'Return dispatch not claimed.');
$injected=false;$module->beginNativeCommand();
try{
    $effects->run($command,$claim['token'],static function()use($returns,$command){
        $result=$returns->execute($command);nativeLabCheck($result['verified']===true,'Return did not reach native effects.');
        throw new RuntimeException('TOTUS_INJECTED_AFTER_NATIVE_RETURN');
    });
}catch(RuntimeException $error){$injected=$error->getMessage()==='TOTUS_INJECTED_AFTER_NATIVE_RETURN';}
finally{$module->endNativeCommand();}
nativeLabCheck($injected,'Failure was not injected after native return.');
nativeLabCheck($snapshot()===$before,'Credit note, detail, stock or movement survived rollback.');
$journal->uncertain($command,$claim['token'],['reason'=>'TOTUS_INJECTED_AFTER_NATIVE_RETURN']);
nativeLabCheck($journal->claim($command)['won']===false,'Rolled back return allowed redispatch.');
nativeLabCheck($effects->receipt($command)===null,'Rolled back return has a committed receipt.');
echo "PASS native credit note, detail counters, stock and movement rollback; durable no-redispatch barrier retained.\n";
