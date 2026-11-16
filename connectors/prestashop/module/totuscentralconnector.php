<?php
/** Totus Central native capability. No front-office payment option or POS UI. */
if (!defined('_PS_VERSION_')) { exit; }
foreach(['Protocol','OrderGridPerformance','NativeCompatibility','JournalSchema','PdoJournal','PdoNativeEffect','CommandRunner','NativeEffectHandler','NativeCartQuote','NativeCartAdjustments','NativeLineAdjustments','NativeCustomers','NativeOwnedCarts','NativePaidPickup','NativeSale','NativeReturns','NativeInventory','NativeCatalogueIndex','NativeCatalogue','NativeDocuments','NativeSetup','NativeRuntime'] as $file)
    require_once __DIR__.'/src/'.$file.'.php';
class Totuscentralconnector extends PaymentModule
{
    private static int $nativeCommandDepth=0;
    private static bool $directoryCompatibility=false;
    public function beginNativeCommand(): void{self::$nativeCommandDepth++;}
    public function endNativeCommand(): void{self::$nativeCommandDepth=max(0,self::$nativeCommandDepth-1);}
    public function hookActionEmailSendBefore(){return self::$nativeCommandDepth===0;}
    protected function getEmailTemplateContent($template_name,$mail_type,$var)
    {
        // Native validateOrder prepares the email before Mail::Send hooks run.
        // Counter sales use Central's receipts; do not invoke storefront theme
        // rendering or its presentation hooks for an email we will not send.
        if(self::$nativeCommandDepth>0)return '';
        return parent::getEmailTemplateContent($template_name,$mail_type,$var);
    }
    public function getOrderShippingCost($cart,$shippingCost){return self::$nativeCommandDepth>0?0:false;}
    public function getOrderShippingCostExternal($cart){return self::$nativeCommandDepth>0?0:false;}
    public function __construct()
    {
        $this->name='totuscentralconnector';$this->tab='administration';$this->version='0.1.9';$this->author='Totus Central';
        $this->bootstrap=true;$this->need_instance=1;$this->ps_versions_compliancy=['min'=>'8.2.8','max'=>'8.2.8'];
        parent::__construct();$this->displayName='Totus Central · capacidad nativa';
        $this->description='Pedidos del mostrador de Totus Central. Sin interfaz de caja ni opción de pago en la web.';
    }
    public function install()
    {
        if(_PS_VERSION_!=='8.2.8' || !(Db::getInstance()->getLink() instanceof PDO))return false;
        if(!parent::install() || !$this->registerHook('addWebserviceResources') || !$this->registerHook('actionEmailSendBefore') || !$this->registerHook('actionOrderGridQueryBuilderModifier') || !$this->registerHook('displayBackOfficeHeader'))return false;
        return $this->ensureOwnStorage();
    }
    public function ensureOwnStorage(): bool
    {
        if((int)$this->id<=0)return false;
        foreach([
            TotusCentralConnector\JournalSchema::mysql(_DB_PREFIX_.'totus_tpv_journal'),
            TotusCentralConnector\PdoNativeEffect::mysqlSchema(_DB_PREFIX_.'totus_tpv_effects'),
            TotusCentralConnector\NativeOwnedCarts::mysqlSchema(_DB_PREFIX_.'totus_tpv_carts'),
            TotusCentralConnector\NativeReturns::mysqlSchema(_DB_PREFIX_.'totus_tpv_returns'),
            TotusCentralConnector\NativeSetup::mysqlSchema(_DB_PREFIX_.'totus_tpv_settings'),
            TotusCentralConnector\NativeCatalogueIndex::mysqlSchema(_DB_PREFIX_.'totus_tpv_catalogue_index'),
        ] as $sql)if(!Db::getInstance()->execute(str_replace('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ',$sql)))return false;
        if(!Configuration::get('TOTUS_TPV_INSTALLATION_ID')){
            $hex=bin2hex(random_bytes(16));$id=substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20,12);
            if(!Configuration::updateValue('TOTUS_TPV_INSTALLATION_ID',$id))return false;
        }
        $statement=Db::getInstance()->getLink()->prepare('INSERT IGNORE INTO `'._DB_PREFIX_.'totus_tpv_settings` (installation_id,shop_id) VALUES (?,?)');
        foreach(Shop::getShops(true,null,true) as $id)if(!$statement->execute([Configuration::get('TOTUS_TPV_INSTALLATION_ID'),(int)$id]))return false;
        // Native hook registration can retain a negative cache entry during
        // this same installation request. Observe persisted bindings directly
        // before invoking the native registration API for missing shops only.
        $shops=array_map('intval',Shop::getCompleteListOfShopsID());
        $registered=Db::getInstance()->getLink()->prepare('SELECT hm.id_shop FROM `'._DB_PREFIX_.'hook_module` hm JOIN `'._DB_PREFIX_.'hook` h ON h.id_hook=hm.id_hook WHERE hm.id_module=? AND h.name=?');
        foreach(['actionObjectAddAfter','actionObjectUpdateAfter','actionObjectDeleteAfter'] as $hook){
            $registered->execute([(int)$this->id,$hook]);$missing=array_values(array_diff($shops,array_map('intval',$registered->fetchAll(PDO::FETCH_COLUMN))));
            if($missing&&!$this->registerHook($hook,$missing))return false;
        }
        // Installation alone never activates an order route or creates customers.
        return true;
    }
    public function hookActionObjectAddAfter(array $params): void{$this->catalogueChanged($params['object']??null);}
    public function hookActionObjectUpdateAfter(array $params): void{$this->catalogueChanged($params['object']??null);}
    public function hookActionObjectDeleteAfter(array $params): void{$this->catalogueChanged($params['object']??null);}
    private function catalogueChanged($object): void
    {
        if(!is_object($object))return;
        if(is_a($object,'SpecificPriceCore')&&(int)($object->id_cart??0)>0)return;
        if(is_a($object,'ConfigurationCore')&&str_starts_with((string)($object->name??''),'TOTUS_TPV_'))return;
        $relevant=false;foreach(['ProductCore','CombinationCore','SpecificPriceCore','SpecificPriceRuleCore','GroupCore','GroupReductionCore',
            'CustomerCore','AddressCore','TaxCore','TaxRuleCore','TaxRulesGroupCore','CurrencyCore','CountryCore','StateCore','ConfigurationCore'] as $class)
            if(is_a($object,$class)){$relevant=true;break;}
        if(!$relevant)return;
        try{$this->nativeProfile();}catch(Throwable $error){return;}
        // Only an owned presentation-cache epoch changes. Never rewrite a native
        // price, order, stock record or third-party configuration from this hook.
        Configuration::updateValue('TOTUS_TPV_CATALOGUE_EPOCH',bin2hex(random_bytes(16)));
    }
    public function uninstall()
    {
        // Preserve owned receipts, installation identity and native financial
        // history for recovery/reinstallation. No DROP or order removal.
        return parent::uninstall();
    }
    public function hookActionOrderGridQueryBuilderModifier(array $params): void
    {
        // The installed QA connector must never alter another installation.
        try{$this->nativeProfile();}catch(Throwable $error){return;}
        TotusCentralConnector\OrderGridPerformance::apply($params['search_query_builder']??null,$params['search_criteria']??null,_DB_PREFIX_);
    }
    public function hookDisplayBackOfficeHeader(): string
    {
        // Fixed diagnostic enum only: no query, customer, filter value or key.
        return '<meta name="totus-orders-plan" content="'.htmlspecialchars(TotusCentralConnector\OrderGridPerformance::$lastStatus,ENT_QUOTES,'UTF-8').'">';
    }
    public function nativeProfile(): array
    {
        TotusCentralConnector\Protocol::ensure(_PS_VERSION_==='8.2.8','NATIVE_VERSION_UNSUPPORTED');
        $lab=defined('TOTUS_DISPOSABLE_NATIVE_LAB') && TOTUS_DISPOSABLE_NATIVE_LAB===true;
        $host=strtolower((string)parse_url(Tools::getHttpHost(true),PHP_URL_HOST));
        TotusCentralConnector\Protocol::ensure(($lab && $host==='127.0.0.1') ||
            (!$lab && $host==='preproduccion.hortimatic.com' && Tools::usingSecureMode()),'QA_ORIGIN_REQUIRED');
        $statement=Db::getInstance()->getLink()->prepare('SELECT profile_json FROM `'._DB_PREFIX_.'totus_tpv_settings` WHERE installation_id=? AND shop_id=?');
        $statement->execute([Configuration::get('TOTUS_TPV_INSTALLATION_ID'),(int)Context::getContext()->shop->id]);$raw=$statement->fetchColumn();
        TotusCentralConnector\Protocol::ensure($raw!==false,'SETTINGS_INSTALLATION_MISSING');
        $profile=$raw!==null?json_decode($raw,true,32,JSON_THROW_ON_ERROR):[];
        TotusCentralConnector\Protocol::ensure(is_array($profile),'NATIVE_PROFILE_INVALID');
        return array_merge($profile,[
            'installation_id'=>(string)Configuration::get('TOTUS_TPV_INSTALLATION_ID'),
            'shop_id'=>(int)Context::getContext()->shop->id,
            'currency_id'=>(int)Configuration::get('PS_CURRENCY_DEFAULT'),
            'language_id'=>(int)Configuration::get('PS_LANG_DEFAULT'),
        ]);
    }
    public function hookAddWebserviceResources(): array
    {
        // Native fetch() invokes this hook after authenticating the API key.
        // Its normal resource/method/shop ACL checks remain unchanged.
        if(!self::$directoryCompatibility&&($_SERVER['HTTP_X_TOTUS_CENTRAL_COMPATIBILITY']??'')==='1'&&
            in_array($_SERVER['REQUEST_METHOD']??'',['GET','POST','PUT','PATCH'],true)&&
            preg_match('#^(customers|addresses)(/[1-9][0-9]*)?$#D',(string)($_GET['url']??''))){
            try{$this->nativeProfile();self::$directoryCompatibility=true;
                $restore=TotusCentralConnector\NativeCompatibility::enter();register_shutdown_function($restore);
            }catch(Throwable $error){/* no compatibility scope outside verified QA */}
        }
        require_once __DIR__.'/Webservice.php';
        $resources=[];
        foreach(['profile','operations','setup','carts','quotes','sales','returns','stock','catalogue','documents','customers'] as $name)$resources['totus_tpv_'.$name]=[
            'description'=>'Totus Central '.$name,'specific_management'=>true,
            'forbidden_method'=>in_array($name,['profile','operations','catalogue','documents','customers'],true)?['POST','PUT','PATCH','DELETE']:($name==='returns'?['PUT','PATCH','DELETE']:['GET','PUT','PATCH','DELETE']),
        ];
        return $resources;
    }
    public function getContent()
    {
        $escape=static fn($value)=>htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');
        $employee=$this->context->employee;
        if(!Validate::isLoadedObject($employee)||!$employee->can('edit','AdminWebservice'))
            return '<div class="alert alert-warning">Necesitas permiso de edición de Webservice para configurar la conexión.</div>';
        try{$this->nativeProfile();}catch(Throwable $error){
            return '<div class="alert alert-warning">Esta versión sólo puede configurarse en Hortimatic preproducción con PrestaShop 8.2.8.</div>';
        }
        $token=Tools::getAdminTokenLite('AdminModules');$message='';
        if(Tools::isSubmit('totusGrantNativeAccess')){
            try{
                TotusCentralConnector\Protocol::ensure($_SERVER['REQUEST_METHOD']==='POST'&&
                    is_string(Tools::getValue('totus_token'))&&hash_equals($token,Tools::getValue('totus_token')),'ADMIN_TOKEN_REQUIRED');
                $id=Tools::getValue('totus_account');
                TotusCentralConnector\Protocol::ensure(is_string($id)&&preg_match('/^[1-9][0-9]{0,9}$/D',$id)===1,'API_ACCOUNT_INVALID');
                $this->grantNativeAccess((int)$id);
                $message='<div class="alert alert-success">Permisos propios guardados y releídos. Los permisos anteriores se conservan. No se ha creado ningún pedido.</div>';
            }catch(Throwable $error){
                // Never render native exception messages: they may contain SQL or credentials.
                $codes=['ADMIN_TOKEN_REQUIRED','API_ACCOUNT_INVALID','ADMIN_TRANSACTION_REQUIRED','EXISTING_RESOURCE_UNAVAILABLE','API_PERMISSION_SAVE_FAILED','API_PERMISSION_READBACK_FAILED'];
                $code=str_replace('TOTUS_','',$error->getMessage());
                $code=in_array($code,$codes,true)?$code:'NATIVE_PERMISSION_ERROR';
                $message='<div class="alert alert-danger">No se han aplicado los permisos. Diagnóstico: '.$code.'. Los cambios de esta operación se revierten.</div>';
            }
        }
        $accounts=Db::getInstance()->executeS('SELECT id_webservice_account,description FROM `'._DB_PREFIX_.'webservice_account` WHERE active=1 ORDER BY description,id_webservice_account');
        $options='<option value="">Selecciona la conexión existente</option>';
        foreach($accounts as $account)$options.='<option value="'.(int)$account['id_webservice_account'].'">#'.(int)$account['id_webservice_account'].' · '.$escape($account['description']).'</option>';
        return $message.'<section class="panel"><h3>Conexión de TotusTPV · preproducción</h3>' .
            '<p>Selecciona la cuenta Webservice que utiliza Totus Central. Se añaden los recursos propios de TotusTPV, las lecturas de catálogo y pedidos, y el alta y edición de clientes y direcciones. La clave no se muestra ni se cambia. Las ventas se operan desde Totus Central.</p>'.
            '<form method="post"><input type="hidden" name="totus_token" value="'.$escape($token).'">'.
            '<label>Cuenta API <select name="totus_account" required>'.$options.'</select></label> '.
            '<button type="submit" name="totusGrantNativeAccess" value="1" class="btn btn-primary">Guardar permisos de TotusTPV</button></form></section>';
    }
    private function grantNativeAccess(int $accountId): void
    {
        $db=Db::getInstance()->getLink();TotusCentralConnector\Protocol::ensure($db instanceof PDO&&!$db->inTransaction(),'ADMIN_TRANSACTION_REQUIRED');
        $db->beginTransaction();
        try{
            $lock=$db->prepare('SELECT id_webservice_account FROM `'._DB_PREFIX_.'webservice_account` WHERE id_webservice_account=? AND active=1 FOR UPDATE');
            $lock->execute([$accountId]);TotusCentralConnector\Protocol::ensure((int)$lock->fetchColumn()===$accountId,'API_ACCOUNT_INVALID');
            $read=$db->prepare('SELECT resource,method FROM `'._DB_PREFIX_.'webservice_permission` WHERE id_webservice_account=? ORDER BY resource,method');
            $read->execute([$accountId]);$before=$read->fetchAll(PDO::FETCH_ASSOC);$permissions=[];
            $resources=WebserviceRequest::getResources();
            foreach(['profile'=>['GET'],'operations'=>['GET'],'setup'=>['POST'],'carts'=>['POST'],
                'quotes'=>['POST'],'sales'=>['POST'],'returns'=>['GET','POST'],'stock'=>['POST'],'catalogue'=>['GET'],'documents'=>['GET'],'customers'=>['GET']] as $resource=>$methods)
                foreach($methods as $method)$permissions['totus_tpv_'.$resource][$method]=true;
            foreach(['carts','customers','addresses','products','combinations','stock_availables','currencies','languages',
                'carriers','orders','order_details','order_states','order_payments','countries','states','groups'] as $resource)$permissions[$resource]['GET']=true;
            foreach(['customers','addresses'] as $resource)foreach(['POST','PUT'] as $method)$permissions[$resource][$method]=true;
            $permissions['customers']['PATCH']=true;
            // Native setPermissionForAccount replaces all ACL rows and drops
            // unavailable resources. Grant additively so legacy permissions and
            // account/shop associations are preserved, including inactive modules.
            $actual=[];foreach($before as $row)$actual[$row['resource']][]=$row['method'];
            foreach($permissions as $resource=>$methods){
                TotusCentralConnector\Protocol::ensure(isset($resources[$resource]),'EXISTING_RESOURCE_UNAVAILABLE');
                foreach(array_keys($methods) as $method){
                    if(in_array($method,$actual[$resource]??[],true))continue;
                    $sql='INSERT INTO `'._DB_PREFIX_."webservice_permission` (resource,method,id_webservice_account) VALUES ('".pSQL($resource)."','".pSQL($method)."',".$accountId.')';
                    TotusCentralConnector\Protocol::ensure(Db::getInstance()->execute($sql),'API_PERMISSION_SAVE_FAILED');
                }
            }
            $read->execute([$accountId]);$rows=$read->fetchAll(PDO::FETCH_ASSOC);$actual=[];
            foreach($rows as $row)$actual[$row['resource']][]=$row['method'];
            foreach($before as $row)TotusCentralConnector\Protocol::ensure(in_array($row['method'],$actual[$row['resource']]??[],true),'API_PERMISSION_READBACK_FAILED');
            foreach($permissions as $resource=>$methods)foreach(array_keys($methods) as $method)
                TotusCentralConnector\Protocol::ensure(in_array($method,$actual[$resource]??[],true),'API_PERMISSION_READBACK_FAILED');
            $db->commit();
        }catch(Throwable $error){if($db->inTransaction())$db->rollBack();throw $error;}
    }
}
