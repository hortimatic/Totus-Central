<?php
/** Native back-office configuration with a synthetic local API account. */
require __DIR__.'/bootstrap.php';
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$accountId=(int)($argv[1]??Db::getInstance()->getValue("SELECT id_webservice_account FROM `"._DB_PREFIX_."webservice_account` WHERE description='Disposable Totus native HTTP QA' ORDER BY id_webservice_account DESC"));$key=new WebserviceKey($accountId);
nativeLabCheck(Validate::isLoadedObject($key)&&$key->description==='Disposable Totus native HTTP QA','Synthetic API account required.');
// This is the disposable installation's seeded administrator, never a remote
// Central or PrestaShop user's session or identity.
$context->employee=new Employee(1);$module=Module::getInstanceByName('totuscentralconnector');
nativeLabCheck($context->employee->can('edit','AdminWebservice'),'Native local fixture administrator missing.');
$before=WebserviceKey::getPermissionForAccount($key->key);
// A migrated installation may retain an ACL belonging to a removed module.
// The native replacement setter drops it; our additive grant must preserve it.
$unknown='totus_disposable_removed_resource';
Db::getInstance()->execute('DELETE FROM `'._DB_PREFIX_.'webservice_permission` WHERE id_webservice_account='.$accountId." AND resource='".$unknown."'");
Db::getInstance()->execute('INSERT INTO `'._DB_PREFIX_."webservice_permission` (resource,method,id_webservice_account) VALUES ('".$unknown."','GET',".$accountId.')');
$before=WebserviceKey::getPermissionForAccount($key->key);
$_SERVER['REQUEST_METHOD']='POST';$_POST=['totusGrantNativeAccess'=>'1','totus_account'=>(string)$accountId,'totus_token'=>'invalid'];
$html=$module->getContent();nativeLabCheck(str_contains($html,'No se han aplicado'),'Invalid token accepted.');
nativeLabCheck(str_contains($html,'ADMIN_TOKEN_REQUIRED'),'Safe diagnostic missing.');
nativeLabCheck(WebserviceKey::getPermissionForAccount($key->key)===$before,'Invalid token altered permissions.');
$_POST['totus_token']=Tools::getAdminTokenLite('AdminModules');$html=$module->getContent();
nativeLabCheck(str_contains($html,'guardados y releídos'),'Native permission configuration failed.');
nativeLabCheck(!str_contains($html,$key->key),'Configuration exposed the API key.');
$after=WebserviceKey::getPermissionForAccount($key->key);
foreach($before as $resource=>$methods)foreach($methods as $method)
    nativeLabCheck(in_array($method,$after[$resource]??[],true),'An existing permission was lost.');
nativeLabCheck($after['orders']===['GET'],'Native orders received unintended write permissions.');
nativeLabCheck($after['totus_tpv_stock']===['POST'],'Own stock permission missing.');
nativeLabCheck($after['products']===['GET']&&$after['combinations']===['GET'],'Generic product/combination write permission must remain absent.');
nativeLabCheck($after['totus_tpv_barcodes']===['GET','POST'],'Scoped barcode read/write permission missing.');
nativeLabCheck($after[$unknown]===['GET'],'Unavailable legacy permission was lost.');
$_POST['totus_account']=(string)$accountId;$again=$module->getContent();
nativeLabCheck(str_contains($again,'guardados y releídos'),'Repeat additive grant failed.');
nativeLabCheck(WebserviceKey::getPermissionForAccount($key->key)===$after,'Repeat grant changed or duplicated ACL.');
Db::getInstance()->execute('DELETE FROM `'._DB_PREFIX_.'webservice_permission` WHERE id_webservice_account='.$accountId." AND resource='".$unknown."'");
$_POST=[];$context->employee=new Employee();
nativeLabCheck(str_contains($module->getContent(),'Necesitas permiso'),'Unauthenticated configuration accepted.');
echo "PASS native permission form: admin scope, CSRF, existing ACL preservation, no key exposure or ordinary order-write grant.\n";
