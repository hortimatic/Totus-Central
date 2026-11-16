<?php
namespace TotusCentralConnector;

/** Explicit QA provisioning. Never runs on installation or on a production host.
 * Own pickup cannot be used by a website checkout: its carrier callback returns
 * false outside an authenticated native-command scope.
 */
final class NativeSetup
{
    private $module;private array $profile;
    public function __construct($module,array $profile){$this->module=$module;$this->profile=$profile;}
    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'SETTINGS_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (installation_id CHAR(36) NOT NULL,shop_id BIGINT UNSIGNED NOT NULL,
            profile_json MEDIUMTEXT NULL,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (installation_id,shop_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
    private function stored(): ?array
    {
        $db=\Db::getInstance()->getLink();
        $s=$db->prepare('SELECT profile_json FROM `'._DB_PREFIX_.'totus_tpv_settings` WHERE installation_id=? AND shop_id=?'.($db->inTransaction()?' FOR UPDATE':''));
        $s->execute([$this->profile['installation_id'],$this->profile['shop_id']]);$raw=$s->fetchColumn();
        Protocol::ensure($raw!==false,'SETTINGS_INSTALLATION_MISSING');if($raw===null)return null;
        $profile=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
        Protocol::ensure(is_array($profile),'NATIVE_PROFILE_INVALID');return $profile;
    }
    private function result(array $p): array
    {
        foreach(['carrier_id','preparing_state_id','paid_state_id','counter_customer_id','counter_address_id'] as $key)
            Protocol::ensure(is_int($p[$key]??null)&&$p[$key]>0,'NATIVE_PROFILE_INCOMPLETE');
        $customer=new \Customer($p['counter_customer_id']);$address=new \Address($p['counter_address_id']);$carrier=new \Carrier($p['carrier_id']);
        Protocol::ensure(\Validate::isLoadedObject($customer)&&\Validate::isLoadedObject($address)&&
            (int)$address->id_customer===(int)$customer->id&&\Validate::isLoadedObject($carrier),'NATIVE_PROFILE_ENTITIES_MISSING');
        $preparing=new \OrderState($p['preparing_state_id']);$paid=new \OrderState($p['paid_state_id']);
        Protocol::ensure($customer->active&&!$customer->deleted&&!$address->deleted&&$carrier->active&&!$carrier->deleted&&
            $carrier->is_module&&$carrier->external_module_name===$this->module->name&&$carrier->shipping_external&&
            \Validate::isLoadedObject($preparing)&&!$preparing->paid&&!$preparing->logable&&!$preparing->invoice&&!$preparing->send_email&&
            \Validate::isLoadedObject($paid)&&$paid->paid&&$paid->logable&&$paid->invoice&&$paid->delivery&&$paid->shipped&&!$paid->send_email,
            'NATIVE_PROFILE_ENTITIES_CHANGED');
        return ['verified'=>true,'native_reference'=>$this->profile['installation_id'],'environment'=>'qa',
            'carrier_id'=>$p['carrier_id'],'counter_customer_id'=>$p['counter_customer_id'],
            'counter_address_id'=>$p['counter_address_id'],'preparing_state_id'=>$p['preparing_state_id'],'paid_state_id'=>$p['paid_state_id']];
    }
    private function state(string $name,bool $paid): int
    {
        $state=new \OrderState();$state->name=[];
        foreach(\Language::getIDs(true) as $id)$state->name[(int)$id]=$name;
        $state->logable=$paid;$state->paid=$paid;$state->invoice=$paid;$state->delivery=$paid;
        $state->shipped=$paid;$state->send_email=false;$state->hidden=true;$state->color=$paid?'#067647':'#667085';
        $state->module_name=$this->module->name;
        Protocol::ensure($state->add(),'NATIVE_STATE_CREATE_FAILED');return (int)$state->id;
    }
    public function execute(array $command): array
    {
        Protocol::ensure(($command['command']??null)==='setup.qa' && ($command['payload']??null)===['confirm_qa'=>true],
            'QA_SETUP_CONFIRMATION_REQUIRED');
        $db=\Db::getInstance()->getLink();Protocol::ensure($db instanceof \PDO&&$db->inTransaction(),'SETUP_TRANSACTION_REQUIRED');
        $existing=$this->stored();if($existing!==null)return $this->result($existing);
        $customer=new \Customer();$customer->firstname='Cliente de prueba';$customer->lastname='TotusTPV';
        $customer->email='totus-tpv-'.$this->profile['installation_id'].'@example.invalid';
        $customer->passwd=password_hash(bin2hex(random_bytes(32)),PASSWORD_BCRYPT);$customer->active=true;
        $customer->id_default_group=(int)\Configuration::get('PS_CUSTOMER_GROUP');
        Protocol::ensure($customer->add(),'QA_COUNTER_CREATE_FAILED');
        $countryId=(int)\Country::getByIso('ES');$country=new \Country($countryId);
        Protocol::ensure(\Validate::isLoadedObject($country)&&$country->active,'QA_COUNTRY_MISSING');
        $address=new \Address();$address->id_customer=(int)$customer->id;$address->id_country=$countryId;
        $address->alias='TotusTPV QA · ficticio';$address->firstname=$customer->firstname;$address->lastname=$customer->lastname;
        $address->address1='Dirección ficticia de pruebas';$address->postcode='28001';$address->city='Madrid';$address->dni='00000000T';
        Protocol::ensure($address->add(),'QA_COUNTER_ADDRESS_FAILED');
        $carrier=new \Carrier();$carrier->name='TotusTPV · entrega en mostrador';$carrier->active=true;
        $carrier->is_module=true;$carrier->is_free=false;$carrier->external_module_name=$this->module->name;
        $carrier->shipping_external=true;$carrier->shipping_handling=false;$carrier->need_range=true;$carrier->range_behavior=0;
        $carrier->shipping_method=\Carrier::SHIPPING_METHOD_PRICE;
        $carrier->delay=[];foreach(\Language::getIDs(true) as $id)$carrier->delay[(int)$id]='Entrega en mostrador de TotusTPV';
        // Customer pricing groups must not change pickup eligibility. The
        // callback, rather than a single counter-customer group, isolates this
        // carrier from ordinary website checkouts.
        $groups=array_map(static fn($row)=>(int)$row['id_group'],\Group::getGroups((int)$this->profile['language_id']));
        Protocol::ensure(count($groups)>0&&$carrier->add()&&$carrier->addZone((int)$country->id_zone)&&
            $carrier->setGroups($groups),'QA_PICKUP_CREATE_FAILED');
        // Native carrier discovery includes module carriers with a native range.
        // The callback still rejects every ordinary website checkout.
        $range=new \RangePrice();$range->id_carrier=(int)$carrier->id;$range->delimiter1=0;$range->delimiter2=999999999;
        Protocol::ensure($range->add()&&$carrier->addDeliveryPrice([[
            'id_carrier'=>(int)$carrier->id,'id_range_price'=>(int)$range->id,'id_range_weight'=>null,
            'id_zone'=>(int)$country->id_zone,'price'=>0,
        ]]),'QA_PICKUP_RANGE_FAILED');
        $profile=['carrier_id'=>(int)$carrier->id,'counter_customer_id'=>(int)$customer->id,'counter_address_id'=>(int)$address->id,
            'preparing_state_id'=>$this->state('TotusTPV · preparando pedido',false),
            'paid_state_id'=>$this->state('TotusTPV · pagado y entregado en mostrador',true),
            'payment_labels'=>['cash'=>'Efectivo','card'=>'Tarjeta','bizum'=>'Bizum','transfer'=>'Transferencia']];
        $s=$db->prepare('UPDATE `'._DB_PREFIX_.'totus_tpv_settings` SET profile_json=?,updated_at=CURRENT_TIMESTAMP WHERE installation_id=? AND shop_id=?');
        Protocol::ensure($s->execute([Protocol::canonical($profile),$this->profile['installation_id'],$this->profile['shop_id']]),'QA_PROFILE_SAVE_FAILED');
        return $this->result($profile);
    }
    public function reconcile(array $command,array $claim): ?array
    {$profile=$this->stored();return $profile!==null?$this->result($profile):null;}
}
