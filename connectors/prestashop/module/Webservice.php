<?php
/** Loaded by addWebserviceResources, after native bootstrap. No public script. */
if (!defined('_PS_VERSION_')) { exit; }
class TotusCentralNativeWebservice implements WebserviceSpecificManagementInterface
{
    protected $wsObject;
    protected $objOutput;
    protected string $output='';
    public function setObjectOutput(WebserviceOutputBuilder $obj){$this->objOutput=$obj;return $this;}
    public function getObjectOutput(){return $this->objOutput;}
    public function setWsObject(WebserviceRequest $obj){$this->wsObject=$obj;return $this;}
    public function getWsObject(){return $this->wsObject;}
    public function getContent(){return $this->output;}
    public function manage()
    {
        $restore=TotusCentralConnector\NativeCompatibility::enter();
        try {
            $resource=(string)($this->wsObject->urlSegment[0]??'');
            $method=(string)$this->wsObject->method;
            $key=$_SERVER['PHP_AUTH_USER']??null;
            TotusCentralConnector\Protocol::ensure(is_string($key) && strlen($key)===32 &&
                !isset($_GET['ws_key']) && WebserviceKey::isKeyActive($key),'NATIVE_AUTH_REQUIRED');
            $account=(int)WebserviceKey::getIdFromKey($key);
            $permissions=WebserviceKey::getPermissionForAccount($key);
            TotusCentralConnector\Protocol::ensure($account>0 && $permissions===$this->wsObject->keyPermissions &&
                in_array($method,$permissions[$resource]??[],true),'NATIVE_AUTH_REQUIRED');
            $module=Module::getInstanceByName('totuscentralconnector');
            TotusCentralConnector\Protocol::ensure($module instanceof Totuscentralconnector && $module->active,'CONNECTOR_DISABLED');
            $profile=$module->nativeProfile();
            $shopId=(int)($this->wsObject->urlFragments['id_shop']??0);
            TotusCentralConnector\Protocol::ensure($shopId===$profile['shop_id'] &&
                (!Shop::isFeatureActive() || Db::getInstance()->getValue('SELECT id_shop FROM `'._DB_PREFIX_.'webservice_account_shop` WHERE id_webservice_account='.$account.' AND id_shop='.$shopId)),'NATIVE_SCOPE_MISMATCH');
            if($resource==='totus_tpv_profile' && $method==='GET'){
                $result=['verified'=>true,'protocol'=>1,'environment'=>'qa','native_version'=>_PS_VERSION_,
                    'installation_id'=>$profile['installation_id'],'shop_id'=>$profile['shop_id'],
                    'currency_id'=>$profile['currency_id'],'currency'=>(new Currency($profile['currency_id']))->iso_code,'language_id'=>$profile['language_id'],
                    'counter_customer_id'=>$profile['counter_customer_id']??null,'counter_address_id'=>$profile['counter_address_id']??null,
                    'carrier_id'=>$profile['carrier_id']??null,'paid_state_id'=>$profile['paid_state_id']??null,
                    'preparing_state_id'=>$profile['preparing_state_id']??null,'payment_labels'=>$profile['payment_labels']??null,
                    'configured'=>isset($profile['carrier_id'],$profile['preparing_state_id'],$profile['paid_state_id'],$profile['counter_customer_id'],$profile['counter_address_id']),
                    'commands'=>['setup.qa','cart.prepare','cart.quote','sale.commit','return.commit','stock.receive']];
            } elseif($resource==='totus_tpv_catalogue' && $method==='GET'){
                $query=array_intersect_key($this->wsObject->urlFragments,array_flip(['search','page','page_size','product_id','customer_id','address_id','category_id','categories_only','sort_field','sort_direction','search_fields','hide_unavailable','excluded_categories','sort_group_id','stock_policy_only','product_capabilities_only']));
                $result=TotusCentralConnector\NativeCatalogue::read($query,$profile);
            } elseif($resource==='totus_tpv_customers' && $method==='GET'){
                $query=array_intersect_key($this->wsObject->urlFragments,array_flip(['search','page','customer_id']));
                $result=TotusCentralConnector\NativeCustomers::read($query,$profile);
            } elseif($resource==='totus_tpv_documents' && $method==='GET'){
                $query=array_intersect_key($this->wsObject->urlFragments,array_flip(['operation_id','actor_id','kind']));
                $result=TotusCentralConnector\NativeDocuments::read($module,$profile,$query,$account);
            } elseif($resource==='totus_tpv_operations' && $method==='GET'){
                $query=$this->wsObject->urlFragments;
                $result=TotusCentralConnector\NativeRuntime::readOperation($module,$profile,
                    (string)($query['operation_id']??''),(string)($query['actor_id']??''),$account);
            } elseif($resource==='totus_tpv_returns' && $method==='GET'){
                $actor=(string)($this->wsObject->urlFragments['actor_id']??'');
                TotusCentralConnector\Protocol::ensure(TotusCentralConnector\Protocol::uuid($actor),'IDENTITY_INVALID');
                $returns=new TotusCentralConnector\NativeReturns(Db::getInstance()->getLink(),$module,$profile,TotusCentralConnector\NativeRuntime::refundServices());
                $result=$returns->available((string)($this->wsObject->urlFragments['sale_operation_id']??''),[
                    'installation_id'=>$profile['installation_id'],'shop_id'=>$shopId,'actor_id'=>$actor,'api_account_id'=>$account]);
            } else {
                TotusCentralConnector\Protocol::ensure($method==='POST','METHOD_FORBIDDEN');
                $stream=fopen('php://input','rb');$body=stream_get_contents($stream,TotusCentralConnector\Protocol::MAX_BODY_BYTES+1);fclose($stream);
                $command=TotusCentralConnector\Protocol::decode($body,$resource,[
                    'authenticated'=>true,'method'=>$method,'resource'=>$resource,'resource_methods'=>$permissions[$resource],
                    'api_account_id'=>$account,'installation_id'=>$profile['installation_id'],
                    'shop_id'=>$shopId,'allowed_shop_ids'=>[$shopId],
                    'enabled_commands'=>['setup.qa','cart.prepare','cart.quote','sale.commit','return.commit','stock.receive'],
                ]);
                $runner=$command['command']==='setup.qa'?TotusCentralConnector\NativeRuntime::setup($module,$profile):TotusCentralConnector\NativeRuntime::create($module,$profile);
                $result=$runner->execute($command);
            }
            $this->objOutput->setHeaderParams('Content-Type','application/json; charset=utf-8');
            $this->objOutput->setHeaderParams('Cache-Control','no-store');
            $this->output=json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
        } catch(Throwable $error){
            $reason=preg_match('/^TOTUS_[A-Z0-9_]{1,90}$/D',$error->getMessage())?$error->getMessage():'TOTUS_NATIVE_UNAVAILABLE';
            throw new WebserviceException($reason,[801,400]);
        } finally {
            $restore();
        }
    }
}
class WebserviceSpecificManagementTotusTpvProfile extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvCarts extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvQuotes extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvSales extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvOperations extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvReturns extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvSetup extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvStock extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvCatalogue extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvDocuments extends TotusCentralNativeWebservice {}
class WebserviceSpecificManagementTotusTpvCustomers extends TotusCentralNativeWebservice {}
