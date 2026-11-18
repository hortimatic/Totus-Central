<?php
namespace TotusCentralConnector;

/** Build real durable providers from native configuration, never HTTP fields. */
final class NativeRuntime
{
    public static function setup($module,array $profile): CommandRunner
    {
        Protocol::ensure(_PS_VERSION_==='8.2.8','NATIVE_VERSION_UNSUPPORTED');
        $native=\Db::getInstance()->getLink();Protocol::ensure($native instanceof \PDO&&!$native->inTransaction(),'NATIVE_PDO_REQUIRED');
        $journal=new PdoJournal(self::connection(),_DB_PREFIX_.'totus_tpv_journal',$profile['installation_id']);
        $effects=new PdoNativeEffect($native,_DB_PREFIX_.'totus_tpv_effects',$journal,static fn()=>\Db::getInstance()->getLink());
        return new CommandRunner($journal,['setup.qa'=>self::scoped($module,$effects,new NativeSetup($module,$profile))]);
    }
    public static function connection(): \PDO
    {
        $settings=(require _PS_ROOT_DIR_.'/app/config/parameters.php')['parameters'];
        $host=(string)$settings['database_host'];$port=trim((string)($settings['database_port']??''));$port=$port===''?3306:(int)$port;
        Protocol::ensure($host!=='' && !preg_match('/[;\x00-\x1f]/',$host) &&
            preg_match('/^[a-zA-Z0-9_]+$/D',$settings['database_name'])===1 && $port>0 && $port<=65535,'NATIVE_DATABASE_CONFIG_INVALID');
        return new \PDO('mysql:host='.$host.';port='.$port.';dbname='.$settings['database_name'].';charset=utf8mb4',
            $settings['database_user'],$settings['database_password'],[
                \PDO::ATTR_ERRMODE=>\PDO::ERRMODE_EXCEPTION,\PDO::ATTR_EMULATE_PREPARES=>false,
            ]);
    }
    public static function create($module,array $profile): CommandRunner
    {
        Protocol::ensure(_PS_VERSION_==='8.2.8','NATIVE_VERSION_UNSUPPORTED');
        $native=\Db::getInstance()->getLink();
        Protocol::ensure($native instanceof \PDO && !$native->inTransaction(),'NATIVE_PDO_REQUIRED');
        $journalTable=_DB_PREFIX_.'totus_tpv_journal';$effectTable=_DB_PREFIX_.'totus_tpv_effects';$cartTable=_DB_PREFIX_.'totus_tpv_carts';
        $dispatch=self::connection();$journal=new PdoJournal($dispatch,$journalTable,$profile['installation_id']);
        $effects=new PdoNativeEffect($native,$effectTable,$journal,static fn()=>\Db::getInstance()->getLink());
        $carts=new NativeOwnedCarts($native,$cartTable,$journalTable,$profile,$effectTable);
        $quoter=new NativeCartQuote([$carts,'owner'],new \PrestaShop\PrestaShop\Adapter\ContextStateManager(new \PrestaShop\PrestaShop\Adapter\LegacyContext()));
        $sale=new NativeSale([$carts,'quote'],[$carts,'owner'],$module,$profile);
        $returns=new NativeReturns($native,$module,$profile,self::refundServices());
        $wrap=static fn($inner)=>self::scoped($module,$effects,$inner);
        return new CommandRunner($journal,[
            'cart.prepare'=>$wrap($carts),'cart.quote'=>$wrap($quoter),'sale.commit'=>$wrap($sale),
            'return.commit'=>$wrap($returns),'stock.receive'=>$wrap(new NativeInventory($native,[$effects,'receipt'])),
            'barcodes.assign'=>new NativeBarcodeEffect($native,$journal,new NativeBarcodeIntents($dispatch,_DB_PREFIX_.'totus_tpv_barcode_intents'),new NativeBarcodes($native,(int)$profile['language_id']),static fn()=>\Db::getInstance()->getLink()),
        ]);
    }
    private static function scoped($module,$effects,$inner): NativeEffectHandler
    {
            $scoped=new class($inner,$module){
                private $inner;private $module;
                public function __construct($inner,$module){$this->inner=$inner;$this->module=$module;}
                public function execute(array $command): array{$this->module->beginNativeCommand();try{return $this->inner->execute($command);}finally{$this->module->endNativeCommand();}}
                public function reconcile(array $command,array $claim): ?array{return $this->inner->reconcile($command,$claim);}
            };
        return new NativeEffectHandler($effects,$scoped);
    }
    public static function refundServices()
    {
        return new class {
            public function get(string $id){
                switch($id){
                    case 'prestashop.adapter.order.refund.order_refund_calculator':return new \PrestaShop\PrestaShop\Adapter\Order\Refund\OrderRefundCalculator();
                    case 'prestashop.adapter.order.refund.updater':return new \PrestaShop\PrestaShop\Adapter\Order\Refund\OrderRefundUpdater();
                    case 'prestashop.adapter.order.refund.order_slip_creator':return new \PrestaShop\PrestaShop\Adapter\Order\Refund\OrderSlipCreator(new \PrestaShop\PrestaShop\Adapter\Configuration(),\Context::getContext()->getTranslator());
                }
                throw new \InvalidArgumentException('TOTUS_NATIVE_SERVICE_FORBIDDEN');
            }
        };
    }
    /** Recovery performs SELECT/readback only. Never execute an absent command. */
    public static function readOperation($module,array $profile,string $operationId,string $actorId,int $account): array
    {
        Protocol::ensure(Protocol::uuid($operationId)&&Protocol::uuid($actorId)&&$account>0,'IDENTITY_INVALID');
        $native=\Db::getInstance()->getLink();Protocol::ensure($native instanceof \PDO,'NATIVE_PDO_REQUIRED');
        $statement=$native->prepare('SELECT * FROM `'._DB_PREFIX_.'totus_tpv_journal` WHERE request_id=?');
        $statement->execute([$operationId]);$row=$statement->fetch(\PDO::FETCH_ASSOC);
        if(!$row)return ['status'=>'not_observed','operation_id'=>$operationId,'retry_command_forbidden'=>true];
        Protocol::ensure($row['installation_id']===$profile['installation_id'] && (int)$row['shop_id']===$profile['shop_id'] &&
            $row['actor_id']===$actorId && (int)$row['api_account_id']===$account,'OPERATION_SCOPE_MISMATCH');
        if($row['command']==='barcodes.assign'){
            $pending=['status'=>'uncertain','operation_id'=>$operationId,'retry_command_forbidden'=>true,'native_command'=>'barcodes.assign','effect_observed'=>false,
                'execution_finished'=>$row['status']==='uncertain'&&$row['error_code']!==null,
                'failure_code'=>preg_match('/^TOTUS_[A-Z0-9_]{1,90}$/D',(string)$row['error_code'])?$row['error_code']:null];
            $dispatch=self::connection();$intents=new NativeBarcodeIntents($dispatch,_DB_PREFIX_.'totus_tpv_barcode_intents');$command=$intents->read($operationId);
            if($command===null)return $pending;
            foreach(['installation_id','api_account_id','shop_id','actor_id','command','fingerprint'] as $key)Protocol::ensure((string)$command[$key]===(string)$row[$key],'OPERATION_RECEIPT_MISMATCH');
            // This exact exception is raised before ObjectModel::update. A
            // matching code written by somebody else is preserved, never
            // relabelled as a successful effect of this failed operation.
            if($row['status']==='uncertain'&&$row['error_code']==='TOTUS_BARCODE_FIELD_ALREADY_SET'){
                $preserved=(new NativeBarcodes($native,(int)$profile['language_id']))->preservedCode($command);
                return $preserved===null?$pending:array_replace($pending,['status'=>'preserved','preserved'=>$preserved]);
            }
            // A completed native journal already contains the verified result
            // recorded after the update and its readback. Later legitimate
            // price/stock edits do not invalidate that historical assignment.
            if($row['status']==='completed'&&$row['result_json']!==null){
                $receipt=json_decode($row['result_json'],true,32,JSON_THROW_ON_ERROR);
                Protocol::ensure(is_array($receipt),'OPERATION_RECEIPT_INVALID');
                (new NativeBarcodes($native,(int)$profile['language_id']))->validateResult($receipt,$command);
                return ['status'=>'verified','operation_id'=>$operationId,'result'=>$receipt,'retry_command_forbidden'=>true];
            }
            $handler=new NativeBarcodeEffect($native,new PdoJournal($dispatch,_DB_PREFIX_.'totus_tpv_journal',$profile['installation_id']),$intents,new NativeBarcodes($native,(int)$profile['language_id']),static fn()=>\Db::getInstance()->getLink());
            $observed=$handler->reconcile($command,[]);
            return $observed===null?$pending:['status'=>'verified','operation_id'=>$operationId,'result'=>$observed,'retry_command_forbidden'=>true];
        }
        $statement=$native->prepare('SELECT * FROM `'._DB_PREFIX_.'totus_tpv_effects` WHERE operation_id=?');
        $statement->execute([$operationId]);$effect=$statement->fetch(\PDO::FETCH_ASSOC);
        if(!$effect)return ['status'=>'uncertain','operation_id'=>$operationId,'retry_command_forbidden'=>true,
            'execution_finished'=>$row['status']==='uncertain' && $row['error_code']!==null,
            'effect_observed'=>false,'native_command'=>$row['command'],
            'failure_code'=>preg_match('/^TOTUS_[A-Z0-9_]{1,90}$/D',(string)$row['error_code'])?$row['error_code']:null];
        foreach(['installation_id','api_account_id','shop_id','actor_id','command','fingerprint'] as $key)
            Protocol::ensure((string)$effect[$key]===(string)$row[$key],'OPERATION_RECEIPT_MISMATCH');
        $receipt=json_decode($effect['result_json'],true,32,JSON_THROW_ON_ERROR);
        Protocol::ensure(($receipt['verified']??false)===true,'OPERATION_RECEIPT_INVALID');
        if($row['command']==='sale.commit'){
            $command=['operation_id'=>$operationId,'installation_id'=>$row['installation_id'],
                'api_account_id'=>$account,'shop_id'=>$profile['shop_id'],'actor_id'=>$actorId,'command'=>'sale.commit',
                'fingerprint'=>$row['fingerprint'],'payload'=>['cart_id'=>$receipt['cart_id'],
                    'quote_operation_id'=>$receipt['quote_operation_id'],'quote_fingerprint'=>$receipt['quote_fingerprint'],
                    'payments'=>$receipt['payment_intent']]];
            $carts=new NativeOwnedCarts($native,_DB_PREFIX_.'totus_tpv_carts',_DB_PREFIX_.'totus_tpv_journal',$profile,_DB_PREFIX_.'totus_tpv_effects');
            Protocol::ensure(is_array($receipt['sale_profile']??null),'SALE_HISTORICAL_PROFILE_MISSING');
            $sale=new NativeSale([$carts,'quote'],[$carts,'owner'],$module,array_merge($profile,$receipt['sale_profile']));
            $observed=$sale->reconcile($command,[]);
            Protocol::ensure(Protocol::canonical($observed)===Protocol::canonical($receipt),'OPERATION_READBACK_CHANGED');
        } elseif($row['command']==='setup.qa'){
            $observed=(new NativeSetup($module,$profile))->reconcile([],[]);
            Protocol::ensure(Protocol::canonical($observed)===Protocol::canonical($receipt),'OPERATION_READBACK_CHANGED');
        } elseif($row['command']==='cart.prepare'){
            $carts=new NativeOwnedCarts($native,_DB_PREFIX_.'totus_tpv_carts',_DB_PREFIX_.'totus_tpv_journal',$profile,_DB_PREFIX_.'totus_tpv_effects');
            $observed=$carts->reconcile(['operation_id'=>$operationId,'installation_id'=>$row['installation_id'],
                'api_account_id'=>$account,'shop_id'=>$profile['shop_id'],'actor_id'=>$actorId],[]);
            Protocol::ensure(Protocol::canonical($observed)===Protocol::canonical($receipt),'OPERATION_READBACK_CHANGED');
        } elseif($row['command']==='return.commit'){
            $handler=new NativeReturns($native,$module,$profile,self::refundServices());
            $observed=$handler->reconcile(['operation_id'=>$operationId,'installation_id'=>$row['installation_id'],
                'api_account_id'=>$account,'shop_id'=>$profile['shop_id'],'actor_id'=>$actorId],[]);
            Protocol::ensure(Protocol::canonical($observed)===Protocol::canonical($receipt),'OPERATION_READBACK_CHANGED');
        } elseif($row['command']==='stock.receive'){
            NativeInventory::verify($receipt,['shop_id'=>$profile['shop_id']]);
        }
        return ['status'=>'verified','operation_id'=>$operationId,'result'=>$receipt,'retry_command_forbidden'=>true];
    }
}
