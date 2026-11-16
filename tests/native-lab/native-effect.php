<?php
/** Failure injection using real native order/payment/stock SQL, local fixture only. */
require __DIR__.'/cart-quote.php';
require __DIR__.'/payment-fixture.php';
require_once nativeLabConnector('PdoJournal');
require_once nativeLabConnector('JournalSchema');
require_once nativeLabConnector('PdoNativeEffect');
use TotusCentralConnector\PdoJournal;
use TotusCentralConnector\JournalSchema;
use TotusCentralConnector\PdoNativeEffect;
use TotusCentralConnector\Protocol;
$native=Db::getInstance()->getLink();nativeLabCheck($native instanceof PDO,'Native driver is not PDO.');
$parameters=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
$dispatchDb=new PDO('mysql:host=127.0.0.1;port=3318;dbname=totus_tpv_lab;charset=utf8mb4',
    $parameters['database_user'],$parameters['database_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$suffix=bin2hex(random_bytes(6));$journalTable='tpv_totus_lab_dispatch_'.$suffix;$effectTable='tpv_totus_lab_effect_'.$suffix;
$installation='00000000-0000-4000-8000-000000000001';
$command=['operation_id'=>'00000000-0000-4000-8000-000000000002','installation_id'=>$installation,
    'actor_id'=>$installation,'api_account_id'=>17,'shop_id'=>1,'command'=>'sale.commit','fingerprint'=>str_repeat('a',64)];
$select=static function(string $sql,array $args=[])use($native){$statement=$native->prepare($sql);$statement->execute($args);return $statement->fetchColumn();};
try{
    $dispatchDb->exec(JournalSchema::mysql($journalTable));$native->exec(PdoNativeEffect::mysqlSchema($effectTable));
    $journal=new PdoJournal($dispatchDb,$journalTable,$installation);
    $effects=new PdoNativeEffect($native,$effectTable,$journal,static fn()=>Db::getInstance()->getLink());
    $claim=$journal->claim($command);$failedOrder=null;$injected=false;
    try{
        $effects->run($command,$claim['token'],static function()use($cart,&$failedOrder){
            $failedOrder=nativeLabPaidOrder($cart,[['method'=>'Tarjeta','amountCents'=>801]]);
            throw new RuntimeException('TOTUS_INJECTED_AFTER_NATIVE_PAYMENT');
        });
    }catch(RuntimeException $error){$injected=$error->getMessage()==='TOTUS_INJECTED_AFTER_NATIVE_PAYMENT';}
    nativeLabCheck($injected&&$failedOrder instanceof Order,'Failure was not injected after native payment.');
    nativeLabCheck((int)$select('SELECT COUNT(*) FROM `'._DB_PREFIX_.'orders` WHERE id_cart=?',[(int)$cart->id])===0,'Native order survived rollback.');
    nativeLabCheck((int)$select('SELECT COUNT(*) FROM `'._DB_PREFIX_.'order_payment` WHERE order_reference=?',[$failedOrder->reference])===0,'Native card payment survived rollback.');
    nativeLabCheck((int)$select('SELECT COUNT(*) FROM `'._DB_PREFIX_.'order_invoice` WHERE id_order=?',[(int)$failedOrder->id])===0,'Native invoice survived rollback.');
    nativeLabCheck((int)$select('SELECT quantity FROM `'._DB_PREFIX_.'stock_available` WHERE id_product=? AND id_product_attribute=0 AND id_shop=1',[(int)$product->id])===5,'Native stock did not roll back.');
    nativeLabCheck($effects->receipt($command)===null,'A rolled back effect has a committed receipt.');
    $journal->uncertain($command,$claim['token'],['reason'=>'TOTUS_INJECTED_AFTER_NATIVE_PAYMENT']);
    nativeLabCheck($journal->claim($command)['won']===false,'Rollback allowed another dispatch.');
    // A distinct cart/operation exercises successful commit and lost response.
    Cache::clean('*');$duplicate=$cart->duplicate();
    nativeLabCheck(in_array($duplicate['success']??false,[true,1],true)&&$duplicate['cart'] instanceof Cart,'Cannot create a distinct next fixture cart.');
    $nextCart=$duplicate['cart'];
    $next=array_replace($command,['operation_id'=>'00000000-0000-4000-8000-000000000003','fingerprint'=>str_repeat('b',64)]);
    $nextClaim=$journal->claim($next);
    $result=$effects->run($next,$nextClaim['token'],static function()use($nextCart){
        $order=nativeLabPaidOrder($nextCart,[['method'=>'Efectivo','amountCents'=>300],['method'=>'Tarjeta','amountCents'=>501]]);
        return ['verified'=>true,'native_reference'=>(int)$order->id,'total_cents'=>801];
    });
    // The response is deliberately not completed in the dispatch journal yet.
    nativeLabCheck($journal->claim($next)['won']===false,'Lost completion response allowed a new native effect.');
    $receipt=$effects->receipt($next);
    nativeLabCheck(Protocol::canonical($receipt)===Protocol::canonical($result),'Committed native receipt missing.');
    nativeLabCheck((int)$select('SELECT COUNT(*) FROM `'._DB_PREFIX_.'orders` WHERE id_cart=?',[(int)$nextCart->id])===1,'Committed native order missing or duplicated.');
    $nativeOrder=new Order($result['native_reference']);
    nativeLabCheck(count($nativeOrder->getOrderPaymentCollection())===2,'Committed split payments missing.');
    $journal->complete($next,null,$receipt);
    nativeLabCheck($journal->claim($next)['status']==='completed','Read-only receipt recovery failed.');
    $scopeRejected=false;
    try{$effects->receipt(array_replace($next,['shop_id'=>2]));}catch(InvalidArgumentException $error){$scopeRejected=true;}
    nativeLabCheck($scopeRejected,'Foreign shop read an effect receipt.');
    echo "PASS actual native order/payment/invoice/stock rollback, separate durable dispatch, committed receipt and lost-response recovery. Mail is disabled in the local lab; external hook side effects and web stock concurrency remain unverified.\n";
}finally{
    if($native->inTransaction())$native->rollBack();
    $native->exec('DROP TABLE IF EXISTS `'.$effectTable.'`');$dispatchDb->exec('DROP TABLE IF EXISTS `'.$journalTable.'`');
}
