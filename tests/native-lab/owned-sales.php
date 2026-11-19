<?php
/** Real native handlers + durable ownership/quote providers, disposable DB only. */
require __DIR__.'/cart-quote.php';
require __DIR__.'/payment-fixture.php';
foreach(['PdoJournal','JournalSchema','PdoNativeEffect','NativeEffectHandler','CommandRunner','NativeCustomers','NativeCartAdjustments','NativeLineAdjustments','NativeOwnedCarts','NativePaidPickup','NativeSale'] as $file)
    require_once nativeLabConnector($file);
use TotusCentralConnector\{Protocol,PdoJournal,JournalSchema,PdoNativeEffect,NativeEffectHandler,CommandRunner,NativeOwnedCarts,NativeSale};
require_once nativeLabConnector('NativeDocuments');
$originalRoundType=(int)Configuration::get('PS_ROUND_TYPE');
$totalRounding=in_array('--total-rounding',$argv,true);
$native=Db::getInstance()->getLink();$parameters=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
$journalDb=new PDO('mysql:host=127.0.0.1;port=3318;dbname=totus_tpv_lab;charset=utf8mb4',
    $parameters['database_user'],$parameters['database_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$suffix=bin2hex(random_bytes(5));$jt='tpv_owned_journal_'.$suffix;$et='tpv_owned_effect_'.$suffix;$ct='tpv_owned_carts_'.$suffix;
$base=['protocol'=>1,'installation_id'=>'00000000-0000-4000-8000-000000000001','shop_id'=>1,
    'actor_id'=>'00000000-0000-4000-8000-000000000002'];
$pickupState=nativeLabState('Totus owned paid pickup',true,true);
$pickupState->shipped=true;nativeLabCheck($pickupState->update(),'Cannot configure native pickup fixture state.');
$profile=['currency_id'=>(int)$context->currency->id,'language_id'=>$languageId,'carrier_id'=>(int)$carrier->id,
    'preparing_state_id'=>(int)nativeLabState('Totus owned preparing',false)->id,
    'paid_state_id'=>(int)$pickupState->id,
    'payment_labels'=>['cash'=>'Efectivo','card'=>'Tarjeta']];
$index=10;$make=static function(string $name,array $payload)use($base,&$index){
    $id='00000000-0000-4000-8000-'.str_pad((string)++$index,12,'0',STR_PAD_LEFT);
    $resource=['cart.prepare'=>'totus_tpv_carts','cart.quote'=>'totus_tpv_quotes','sale.commit'=>'totus_tpv_sales'][$name];
    return Protocol::decode(json_encode(array_merge($base,['operation_id'=>$id,'command'=>$name,'payload'=>$payload]),JSON_THROW_ON_ERROR),$resource,
        ['authenticated'=>true,'method'=>'POST','resource'=>$resource,'resource_methods'=>['POST'],'api_account_id'=>17,
        'installation_id'=>$base['installation_id'],'shop_id'=>1,'allowed_shop_ids'=>[1],'enabled_commands'=>['cart.prepare','cart.quote','sale.commit']]);
};
try {
    if($totalRounding)Configuration::updateValue('PS_ROUND_TYPE',3);
    $journalDb->exec(JournalSchema::mysql($jt));$native->exec(PdoNativeEffect::mysqlSchema($et));$native->exec(NativeOwnedCarts::mysqlSchema($ct));
    $journal=new PdoJournal($journalDb,$jt,$base['installation_id']);
    $effects=new PdoNativeEffect($native,$et,$journal,static fn()=>Db::getInstance()->getLink());
    $owned=new NativeOwnedCarts($native,$ct,$jt,$profile,$et);
    $quoteHandler=new TotusCentralConnector\NativeCartQuote([$owned,'owner'],new PrestaShop\PrestaShop\Adapter\ContextStateManager(new PrestaShop\PrestaShop\Adapter\LegacyContext()));
    $sale=new NativeSale([$owned,'quote'],[$owned,'owner'],new TotusPaymentFixture(),$profile);
    $diagnostic=new class($sale) {
        private $handler;public function __construct($handler){$this->handler=$handler;}
        public function execute(array $command): array {try{return $this->handler->execute($command);}catch(Throwable $error){fwrite(STDERR,get_class($error).': '.$error->getMessage()."\n".$error->getTraceAsString()."\n");throw $error;}}
        public function reconcile(array $command,array $claim): ?array{return $this->handler->reconcile($command,$claim);}
    };
    $runner=new CommandRunner($journal,['cart.prepare'=>new NativeEffectHandler($effects,$owned),
        'cart.quote'=>new NativeEffectHandler($effects,$quoteHandler),'sale.commit'=>new NativeEffectHandler($effects,$diagnostic)]);
    $methods=[
        [['method'=>'cash','amount_cents'=>801,'received_cents'=>1000]],
        [['method'=>'card','amount_cents'=>801]],
        [['method'=>'cash','amount_cents'=>300,'received_cents'=>500],['method'=>'card','amount_cents'=>501]],
    ];$results=[];
    foreach($methods as $payments){
        Cache::clean('*');
        $prepare=$make('cart.prepare',['session_id'=>'00000000-0000-4000-8000-000000000003',
            'drawer_id'=>'00000000-0000-4000-8000-000000000004','customer_id'=>(int)$customer->id,
            'invoice_address_id'=>(int)$address->id,'delivery_address_id'=>(int)$address->id,
            'lines'=>[['product_id'=>(int)$product->id,'attribute_id'=>0,'quantity'=>1]]]);
        $prepared=$runner->execute($prepare);nativeLabCheck(($prepared['verified']??false)===true,'Owned preparation failed: '.json_encode($prepared));
        nativeLabCheck($runner->execute($prepare)===$prepared,'Preparation replay changed cart.');
        $quoteCommand=$make('cart.quote',['cart_id'=>$prepared['cart_id']]);$quoted=$runner->execute($quoteCommand);
        nativeLabCheck(($quoted['quote']['total_cents']??null)===801,'Owned quote failed: '.json_encode($quoted));
        $command=$make('sale.commit',['cart_id'=>$prepared['cart_id'],'quote_operation_id'=>$quoteCommand['operation_id'],
            'quote_fingerprint'=>$quoted['quote_fingerprint'],'payments'=>$payments]);
        $paid=$runner->execute($command);nativeLabCheck(($paid['verified']??false)===true,'Owned sale failed: '.json_encode($paid));
        nativeLabCheck(count($paid['invoice_ids'])===1,'Owned sale has no unique invoice.');
        nativeLabCheck(($paid['order_evidence']['totalTaxExclCents']??null)===(int)round(100*(float)$quoted['quote']['total_tax_excl']),'Missing verified net amount in native evidence.');
        if($totalRounding){
            $line=$paid['order_evidence']['lines'][0];$nativeLine=$quoted['quote']['lines'][0];
            nativeLabCheck(($line['lineTaxInclMicros']??null)===(int)round(1000000*(float)$nativeLine['line_tax_incl'])&&($line['lineTaxExclMicros']??null)===(int)round(1000000*(float)$nativeLine['line_tax_excl']),'Total-rounded line precision lost.');
            nativeLabCheck($line['lineTaxInclCents']===801,'Total-rounded line does not match the charged amount.');
        }
        // A matching payment is insufficient when the saved taxable base differs.
        // Change only this disposable fixture, then restore it even on failure.
        if(count($results)===0){
            foreach([['orders','id_order',$paid['order_id']],['order_invoice','id_order_invoice',$paid['invoice_ids'][0]]] as [$table,$idColumn,$id]){
                $table=_DB_PREFIX_.$table;
                $original=$native->query('SELECT total_paid_tax_excl FROM `'.$table.'` WHERE `'.$idColumn.'`='.(int)$id)->fetchColumn();
                try{
                    $native->exec('UPDATE `'.$table.'` SET total_paid_tax_excl=total_paid_tax_excl+0.01 WHERE `'.$idColumn.'`='.(int)$id);
                    Cache::clean('*');
                    $rejected=false;
                    try{$sale->reconcile($command,[]);}catch(InvalidArgumentException $error){$rejected=$error->getMessage()===('TOTUS_'.($idColumn==='id_order'?'SALE_ORDER_READBACK_FAILED':'SALE_INVOICE_AMOUNT_READBACK_FAILED'));}
                    nativeLabCheck($rejected,'Native readback accepted a changed taxable base.');
                }finally{
                    $restore=$native->prepare('UPDATE `'.$table.'` SET total_paid_tax_excl=? WHERE `'.$idColumn.'`=?');$restore->execute([$original,$id]);
                    Cache::clean('*');
                }
            }
            nativeLabCheck(($sale->reconcile($command,[])['verified']??false)===true,'Restored native fixture did not reconcile.');
        }
        nativeLabCheck($runner->execute($command)===$paid,'Paid replay changed the receipt.');
        $copy=$command;$copy['actor_id']='00000000-0000-4000-8000-000000000099';
        $foreign=false;try{$sale->reconcile($copy,[]);}catch(InvalidArgumentException $error){$foreign=true;}
        nativeLabCheck($foreign,'Another operator adopted this owned sale.');
        $results[]=$paid;
    }
    Cache::clean('*');nativeLabCheck((int)StockAvailable::getQuantityAvailableByProduct((int)$product->id,0,1)===2,'Three owned sales did not deduct exactly three units.');
    nativeLabCheck(count(array_unique(array_column($results,'order_id')))===3,'Distinct sales reused a native order.');
    file_put_contents($project.'/artifacts/native-lab/latest-owned-sales.json',json_encode([
        'mode'=>'local-native-owned-handlers','results'=>$results,'finalStock'=>2,'remoteShopTouched'=>false,
        'note'=>'Native PHP handlers and durable ownership/quote providers; HTTP adapter not exercised.'
    ],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
    echo "PASS native owned carts, persisted quotes, cash/card/mixed sales, invoices, stock, operator isolation and replay without duplicate orders. Local only.\n";
} finally {
    if($totalRounding)Configuration::updateValue('PS_ROUND_TYPE',$originalRoundType);
    if($native->inTransaction())$native->rollBack();
    foreach([$et,$ct,$jt] as $table)$native->exec('DROP TABLE IF EXISTS `'.$table.'`');
}
