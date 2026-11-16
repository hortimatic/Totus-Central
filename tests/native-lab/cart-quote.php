<?php
require __DIR__.'/bootstrap.php';
// An installed carrier module is loaded by native carrier discovery. Use that
// same class set, after checking it matches the source under test.
if(Module::isInstalled('totuscentralconnector')){
    foreach(['Protocol','NativeCartQuote'] as $class)nativeLabCheck(
        hash_file('sha256',$project.'/connectors/prestashop/src/'.$class.'.php')===
        hash_file('sha256',$nativeRoot.'/modules/totuscentralconnector/src/'.$class.'.php'),'Installed fixture source is stale.');
    Module::getInstanceByName('totuscentralconnector');
}else{
    require $project.'/connectors/prestashop/src/Protocol.php';
    require $project.'/connectors/prestashop/src/NativeCartQuote.php';
}
use TotusCentralConnector\NativeCartQuote;
use PrestaShop\PrestaShop\Adapter\ContextStateManager;
use PrestaShop\PrestaShop\Adapter\LegacyContext;
$run=bin2hex(random_bytes(6));
$languageId=(int)$context->language->id;$countryId=(int)Country::getByIso('ES');
nativeLabCheck($countryId>0,'Spain fixture is missing.');
$customer=new Customer();$customer->firstname='Totus';$customer->lastname='Fixture';
$customer->email='native-qa-'.$run.'@example.invalid';$customer->passwd=password_hash('LocalFixtureOnly828',PASSWORD_BCRYPT);
$customer->active=true;$customer->id_default_group=(int)Configuration::get('PS_CUSTOMER_GROUP');
nativeLabCheck($customer->add(),'Cannot create synthetic local customer.');
$address=new Address();$address->id_customer=(int)$customer->id;$address->id_country=$countryId;
$address->alias='Native fixture';$address->firstname='Totus';$address->lastname='Fixture';
$address->address1='Calle ficticia de pruebas';$address->postcode='28001';$address->city='Madrid';
$address->dni='00000000T'; // Synthetic identifier, only in this disposable local fixture.
nativeLabCheck($address->add(),'Cannot create synthetic local address.');
$carrier=new Carrier();$carrier->name='Totus fixture pickup';$carrier->active=true;$carrier->is_free=true;
$carrier->is_module=false;$carrier->shipping_handling=false;$carrier->shipping_external=false;
$carrier->need_range=false;$carrier->range_behavior=0;$carrier->delay=[$languageId=>'Local fixture pickup'];
nativeLabCheck($carrier->add(),'Cannot create local fixture carrier.');
$country=new Country($countryId);nativeLabCheck($carrier->addZone((int)$country->id_zone),'Cannot assign local carrier zone.');
nativeLabCheck($carrier->setGroups([(int)$customer->id_default_group]),'Cannot assign local carrier group.');
$taxGroup=(int)Db::getInstance()->getValue('SELECT tr.id_tax_rules_group FROM `'._DB_PREFIX_.'tax_rule` tr
 JOIN `'._DB_PREFIX_.'tax` t ON t.id_tax=tr.id_tax JOIN `'._DB_PREFIX_.'tax_rules_group` g ON g.id_tax_rules_group=tr.id_tax_rules_group
 WHERE tr.id_country='.$countryId.' AND t.active=1 AND t.rate=21 AND g.active=1 AND g.deleted=0 ORDER BY tr.id_tax_rules_group');
nativeLabCheck($taxGroup>0,'Native 21% tax fixture missing.');
$product=new Product();$product->name=[$languageId=>'Totus native fixture '.$run];
$product->link_rewrite=[$languageId=>'totus-native-'.$run];$product->reference='QA-'.$run;
$product->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');$product->id_tax_rules_group=$taxGroup;
$product->price='6.621570';$product->wholesale_price='4.000000';$product->active=true;
$product->available_for_order=true;$product->minimal_quantity=1;$product->is_virtual=false;
nativeLabCheck($product->add(),'Cannot create synthetic local product.');
nativeLabCheck($product->addToCategories([(int)$product->id_category_default]),'Cannot assign synthetic category.');
StockAvailable::setQuantity((int)$product->id,0,5,1);
$cart=new Cart();$cart->id_shop=1;$cart->id_shop_group=1;$cart->id_customer=(int)$customer->id;
$cart->id_address_invoice=(int)$address->id;$cart->id_address_delivery=(int)$address->id;
$cart->id_currency=(int)$context->currency->id;$cart->id_lang=$languageId;$cart->id_carrier=(int)$carrier->id;
$cart->secure_key=$customer->secure_key;$cart->gift=false;$cart->recyclable=false;
nativeLabCheck($cart->add(),'Cannot create local cart.');
$context->cart=$cart;$context->customer=$customer;
nativeLabCheck($cart->updateQty(1,(int)$product->id)>0,'Cannot add product to local cart.');
$cart->setDeliveryOption([(int)$address->id=>$carrier->id.',']);nativeLabCheck($cart->update(),'Cannot set local pickup.');
$installation='00000000-0000-4000-8000-000000000001';
$owner=['verified'=>true,'cart_id'=>(int)$cart->id,'shop_id'=>1,'installation_id'=>$installation,
 'api_account_id'=>17,'customer_id'=>(int)$customer->id];
$handler=new NativeCartQuote(static fn()=> $owner,new ContextStateManager(new LegacyContext()));
$result=$handler->execute(['command'=>'cart.quote','shop_id'=>1,'installation_id'=>$installation,'api_account_id'=>17,
 'payload'=>['cart_id'=>(int)$cart->id]]);
nativeLabCheck($result['verified']===true,'Native cart quote was not verified.');
nativeLabCheck($result['quote']['total_cents']===801,'Native payable total should be 8.01 EUR.');
nativeLabCheck($result['quote']['lines'][0]['unit_tax_incl']==='8.012100','Native six-decimal price was lost.');
nativeLabCheck($result['quote']['lines'][0]['line_tax_incl']==='8.010000','Native line rounding was lost.');
nativeLabCheck((int)StockAvailable::getQuantityAvailableByProduct((int)$product->id,0,1)===5,'Quoting must not deduct stock.');
file_put_contents($project.'/artifacts/native-lab/latest-cart.json',json_encode(['mode'=>'local-native-fixture',
 'cartId'=>(int)$cart->id,'customerId'=>(int)$customer->id,'addressId'=>(int)$address->id,'carrierId'=>(int)$carrier->id,
 'productId'=>(int)$product->id,'quote'=>$result],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "PASS actual local PrestaShop "._PS_VERSION_." + MariaDB: native cart calculation, tax, six-decimal unit, rounded line and unchanged stock. Ownership provider is a fixture.\n";
