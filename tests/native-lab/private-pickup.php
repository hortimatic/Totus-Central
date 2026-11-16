<?php
require __DIR__.'/bootstrap.php';
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$module=Module::getInstanceByName('totuscentralconnector');$profile=$module->nativeProfile();
$cart=new Cart((int)Db::getInstance()->getValue('SELECT MAX(cart_id) FROM `'._DB_PREFIX_.'totus_tpv_carts`'));
nativeLabCheck(Validate::isLoadedObject($cart),'Owned fixture cart missing.');
$context=Context::getContext();$context->cart=$cart;$context->customer=new Customer($cart->id_customer);
$address=new Address($cart->id_address_delivery);$context->country=new Country($address->id_country);
nativeLabCheck($module->getOrderShippingCostExternal($cart)===false,'Pickup leaked to website callback.');
$errors=[];$public=Carrier::getCarriersForOrder((int)$context->country->id_zone,$context->customer->getGroups(),$cart,$errors);
nativeLabCheck(!in_array($profile['carrier_id'],array_map(static fn($c)=>(int)$c['id_carrier'],$public),true),'Pickup leaked to public checkout.');
nativeLabCheck($module->hookActionEmailSendBefore()===true,'Normal website mail was disabled.');
$template=new ReflectionMethod($module,'getEmailTemplateContent');
$module->beginNativeCommand();
try{
    nativeLabCheck($template->invoke($module,'must-not-render.tpl',Mail::TYPE_HTML,[])==='','Counter sale entered storefront mail rendering.');
    nativeLabCheck($module->hookActionEmailSendBefore()===false,'Counter sale unexpectedly enabled mail.');
}finally{$module->endNativeCommand();}
nativeLabCheck($module->hookActionEmailSendBefore()===true,'Native scope changed normal website mail.');
echo "PASS private pickup excluded from native public checkout; normal mail unaffected.\n";
