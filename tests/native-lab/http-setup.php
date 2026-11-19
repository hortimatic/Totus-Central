<?php
require __DIR__.'/bootstrap.php';
require __DIR__.'/payment-fixture.php';
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,32,JSON_THROW_ON_ERROR);
nativeLabCheck(($fixture['mode']??null)==='local-native-fixture','Missing isolated product/customer fixture.');
$product=new Product((int)$fixture['productId']);$customer=new Customer((int)$fixture['customerId']);
$address=new Address((int)$fixture['addressId']);$carrier=new Carrier((int)$fixture['carrierId']);
nativeLabCheck(Validate::isLoadedObject($product)&&Validate::isLoadedObject($customer)&&Validate::isLoadedObject($address)&&Validate::isLoadedObject($carrier),'Native fixture entities missing.');
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$module=Module::getInstanceByName('totuscentralconnector');
nativeLabCheck($module instanceof Totuscentralconnector,'Native package did not load.');
nativeLabCheck(Module::isInstalled('totuscentralconnector'),'Run isolated installation in a separate native request first.');
$module->active=true;
// Reset only this disposable installation's own setup row to test provisioning.
$s=Db::getInstance()->getLink()->prepare('UPDATE `'._DB_PREFIX_.'totus_tpv_settings` SET profile_json=NULL WHERE installation_id=? AND shop_id=1');
nativeLabCheck($s->execute([Configuration::get('TOTUS_TPV_INSTALLATION_ID')]),'Cannot reset disposable setup row.');
nativeLabCheck(Configuration::updateValue('PS_WEBSERVICE',1),'Cannot enable disposable native Webservice.');
$context->employee=new Employee(1); // Seeded local administrator creates this fictional API account.
$key=new WebserviceKey();$key->key=bin2hex(random_bytes(16));$key->active=true;$key->description='Disposable Totus native HTTP QA';
nativeLabCheck($key->add(),'Cannot create synthetic local API key.');
$permission=['totus_tpv_profile'=>['GET'=>true],'totus_tpv_operations'=>['GET'=>true],
    'totus_tpv_carts'=>['POST'=>true],'totus_tpv_quotes'=>['POST'=>true],'totus_tpv_sales'=>['POST'=>true],
    'totus_tpv_returns'=>['GET'=>true,'POST'=>true],'totus_tpv_setup'=>['POST'=>true],'totus_tpv_stock'=>['POST'=>true]];
foreach(['orders','order_details','order_states','order_payments','currencies','stock_availables'] as $resource)$permission[$resource]=['GET'=>true];
nativeLabCheck(WebserviceKey::setPermissionForAccount((int)$key->id,$permission),'Cannot scope synthetic API key.');
nativeLabCheck(count(WebserviceKey::getPermissionForAccount($key->key))===14,'Native hook resource registration failed.');
// Consumed in memory by the Node fixture. Never uses a remote shop credential.
echo json_encode(['key'=>$key->key,'keyId'=>(int)$key->id,'installationId'=>Configuration::get('TOTUS_TPV_INSTALLATION_ID'),
    'productId'=>(int)$product->id,'reference'=>(string)$product->reference,'customerId'=>(int)$customer->id,'addressId'=>(int)$address->id],JSON_THROW_ON_ERROR)."\n";
