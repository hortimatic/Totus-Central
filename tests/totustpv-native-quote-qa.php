<?php
/** Native classes below are fixtures, NOT a PrestaShop installation. */
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeCartQuote.php';
use TotusCentralConnector\NativeCartQuote;
final class Validate {public static function isLoadedObject($object){return $object->id>0;}}
class Entity {public int $id;public bool $active=true;public bool $deleted=false;public function __construct($id){$this->id=$id;}}
final class Customer extends Entity {}
final class Address extends Entity {public int $id_customer=501;public int $id_country=6;}
final class Currency extends Entity {public int $precision=2;public string $iso_code='EUR';}
final class Language extends Entity {}
final class Shop extends Entity {}
final class Country extends Entity {}
final class Configuration {public static function get($key){return ['PS_TAX_ADDRESS_TYPE'=>'id_address_invoice','PS_PRICE_ROUND_MODE'=>2,'PS_ROUND_TYPE'=>2][$key]??null;}}
final class Tools {public static function ps_round($value,$precision,$mode){return round($value,$precision);}}
final class Cart {
 public const BOTH=3,ONLY_PRODUCTS=1,ONLY_SHIPPING=5,ONLY_DISCOUNTS=2;
 public int $id=701,$id_shop=1,$id_customer=501,$id_address_invoice=601,$id_address_delivery=602,$id_currency=1,$id_lang=1,$id_carrier=5;
 public bool $ordered=false,$fail=false,$rulesApplied=false,$gift=false,$recyclable=false,$allow_seperated_package=false;
 public function orderExists(){return $this->ordered;}
 public function getProducts($refresh){
  if(!$this->rulesApplied)throw new Exception('Automatic rules must run before reading lines');
  if($this->fail)throw new RuntimeException('Fixture failure');
  return [['id_product'=>101,'id_product_attribute'=>7,'cart_quantity'=>1,'price_wt'=>'8.01',
   'price'=>'99.00','price_with_reduction_without_tax'=>'6.619835','total_wt'=>'8.01','total'=>'6.619835']];
 }
 public function getOrderTotal($tax,$type){$this->rulesApplied=true;return match($type){self::BOTH,self::ONLY_PRODUCTS=>$tax?'8.01':'6.619835',self::ONLY_SHIPPING,self::ONLY_DISCOUNTS=>'0.00'};}
}
final class ContextFixture {
 public array $set=[];public int $restored=0;
 public function setShop($x){$this->set[]='shop';}public function setCart($x){$this->set[]='cart';}
 public function setCustomer($x){$this->set[]='customer';}public function setCurrency($x){$this->set[]='currency';}
 public function setLanguage($x){$this->set[]='language';}public function setCountry($x){$this->set[]='country';}
 public function restorePreviousContext(){$this->restored++;}
}
$checks=0;
function check($ok){global $checks;if(!$ok)throw new Exception('Failed assertion '.($checks+1));$checks++;}
function rejects($fn,$code){try{$fn();}catch(Throwable $e){check(str_contains($e->getMessage(),$code));return;}throw new Exception('Expected '.$code);}
$command=['command'=>'cart.quote','payload'=>['cart_id'=>701],'shop_id'=>1,'installation_id'=>'installation-fixture','api_account_id'=>3];
$owner=['verified'=>true,'cart_id'=>701,'shop_id'=>1,'installation_id'=>'installation-fixture','api_account_id'=>3,'customer_id'=>501];
$context=new ContextFixture();$cart=new Cart();$handler=new NativeCartQuote(fn()=> $owner,$context,fn()=> $cart);
$result=$handler->execute($command);
check($result['verified']===true);check($result['quote']['total_cents']===801);
check($result['quote']['lines'][0]['unit_tax_excl']==='6.619835');
check($result['quote']['lines'][0]['unit_tax_excl']!=='99.000000');
check($context->set===['shop','cart','customer','currency','language','country']);check($context->restored===1);
$cart->fail=true;rejects(fn()=> $handler->execute($command),'Fixture failure');check($context->restored===2);$cart->fail=false;
$cart->ordered=true;rejects(fn()=> $handler->execute($command),'ALREADY_ORDERED');$cart->ordered=false;
rejects(fn()=> $handler->execute([...$command,'shop_id'=>2]),'OWNERSHIP_REQUIRED');
rejects(fn()=> $handler->execute([...$command,'payload'=>['cart_id'=>701,'override_total'=>1]]),'QUOTE_INVALID');
$denied=new NativeCartQuote(fn()=> null,$context,fn()=> $cart);rejects(fn()=> $denied->execute($command),'OWNERSHIP_REQUIRED');
check($handler->reconcile($command,[])===null);
echo "PASS native quote boundary: {$checks} assertions using fixture native classes. Not a native order or installed endpoint.\n";
