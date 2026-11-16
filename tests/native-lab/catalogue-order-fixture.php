<?php
require __DIR__.'/bootstrap.php';
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$module=Module::getInstanceByName('totuscentralconnector');
nativeLabCheck($module instanceof Totuscentralconnector&&Module::isInstalled($module->name),'Installed disposable module required');
$profile=$module->nativeProfile();$file=$project.'/artifacts/native-lab/catalogue-order-fixture.json';
if(($argv[1]??'')==='price-change'){
 $fixture=json_decode(file_get_contents($file),true,16,JSON_THROW_ON_ERROR);$last=count($fixture['ids'])-1;
 $product=new Product($fixture['ids'][$last]);$product->price='99.01';nativeLabCheck($product->update(),'Cannot update native fixture price');
 $fixture['basePrices'][$last]=9901;
}elseif(($argv[1]??'')==='scheduled-expiry'){
 $fixture=json_decode(file_get_contents($file),true,16,JSON_THROW_ON_ERROR);$specific=new SpecificPrice($fixture['specificPriceId']);
 $specific->to=date('Y-m-d H:i:s',time()+5);nativeLabCheck($specific->update(),'Cannot schedule native fixture offer expiry');
 $fixture['expirationEpoch']=intdiv(strtotime($specific->to),60)*60+60;
}else{
 $other=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,16,JSON_THROW_ON_ERROR);
 $prefix='QA-ORDER-'.bin2hex(random_bytes(5));$lang=(int)$context->language->id;$ids=[];$prices=[];
 for($i=0;$i<27;$i++){
  $product=new Product();$product->name=[$lang=>$prefix.' '.str_pad((string)$i,2,'0',STR_PAD_LEFT)];
  $product->link_rewrite=[$lang=>strtolower($prefix.'-'.$i)];$product->reference=$prefix.'-'.str_pad((string)$i,2,'0',STR_PAD_LEFT);
  $prices[]=(27-$i)*100+1;$product->price=number_format(end($prices)/100,2,'.','');$product->wholesale_price=number_format(($i+1)/5,2,'.','');
  $product->id_tax_rules_group=0;$product->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');
  $product->active=true;$product->available_for_order=true;$product->visibility='both';$product->minimal_quantity=1;
  nativeLabCheck($product->add()&&$product->updateCategories([$product->id_category_default]),'Cannot create native catalogue fixture');
  StockAvailable::setQuantity((int)$product->id,0,$i+1,1);$ids[]=(int)$product->id;
 }
 $specific=new SpecificPrice();$specific->id_product=$ids[0];$specific->id_shop=1;$specific->id_shop_group=0;$specific->id_currency=0;
 $specific->id_country=0;$specific->id_group=0;$specific->id_customer=(int)$profile['counter_customer_id'];$specific->id_cart=0;
 $specific->id_product_attribute=0;$specific->price='0.37';$specific->from_quantity=1;$specific->reduction=0;
 $specific->reduction_tax=1;$specific->reduction_type='amount';$specific->from='0000-00-00 00:00:00';$specific->to='0000-00-00 00:00:00';
 nativeLabCheck($specific->add(),'Cannot create native contextual price');
 nativeLabCheck((int)$other['customerId']!==(int)$profile['counter_customer_id'],'Distinct native customer context required');
 $fixture=['prefix'=>$prefix,'ids'=>$ids,'basePrices'=>$prices,'specificPriceId'=>(int)$specific->id,
  'otherCustomerId'=>(int)$other['customerId'],'otherAddressId'=>(int)$other['addressId']];
}
file_put_contents($file,json_encode($fixture,JSON_THROW_ON_ERROR));echo json_encode($fixture,JSON_THROW_ON_ERROR)."\n";
