<?php
require __DIR__.'/bootstrap.php';
$withOrder=in_array('--order',$argv,true);
$types=[1,2,3];foreach($argv as $arg)if(preg_match('/^--type=([123])$/',$arg,$match))$types=[(int)$match[1]];
if($withOrder){$context->employee=new Employee(1);nativeLabCheck(Validate::isLoadedObject($context->employee),'Missing local employee.');require_once __DIR__.'/payment-fixture.php';}
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,32,JSON_THROW_ON_ERROR);
nativeLabCheck(($fixture['mode']??null)==='local-native-fixture','Missing owned local fixture.');
$customer=new Customer((int)$fixture['customerId']);
nativeLabCheck(Validate::isLoadedObject($customer)&&str_ends_with($customer->email,'@example.invalid'),'Not a synthetic customer.');
$mixed=in_array('--mixed-tax',$argv,true);$source=new Product((int)$fixture['productId']);
nativeLabCheck(Validate::isLoadedObject($source)&&str_starts_with($source->reference,'QA-')&&(int)$source->id_tax_rules_group>0,'Missing fixture tax source.');
$context->customer=$customer;$lang=(int)$context->language->id;$ids=[];$run=bin2hex(random_bytes(6));
foreach(['A','B'] as $suffix){
 $product=new Product();$product->name=[$lang=>'Redondeo QA '.$run.$suffix];$product->link_rewrite=[$lang=>'redondeo-'.$run.$suffix];
 $product->reference='QA-ROUND-'.$run.$suffix;$product->id_category_default=(int)Configuration::get('PS_HOME_CATEGORY');
 $product->id_tax_rules_group=$mixed&&$suffix==='B'?(int)$source->id_tax_rules_group:0;$product->price='1.005000';$product->active=true;$product->available_for_order=true;$product->minimal_quantity=1;
 nativeLabCheck($product->add()&&$product->addToCategories([(int)$product->id_category_default]),'Cannot create rounding product.');
 StockAvailable::setQuantity((int)$product->id,0,20,1);$ids[]=(int)$product->id;
}
$originalType=Configuration::get('PS_ROUND_TYPE');$originalMode=Configuration::get('PS_PRICE_ROUND_MODE');$results=[];
try{
 Configuration::updateValue('PS_PRICE_ROUND_MODE',2);
 foreach($types as $type){
  Configuration::updateValue('PS_ROUND_TYPE',$type);
  $cart=new Cart();$cart->id_shop=1;$cart->id_shop_group=1;$cart->id_customer=(int)$customer->id;
  $cart->id_address_invoice=$cart->id_address_delivery=(int)$fixture['addressId'];$cart->id_carrier=(int)$fixture['carrierId'];
  $cart->id_currency=(int)$context->currency->id;$cart->id_lang=$lang;$cart->secure_key=$customer->secure_key;
  nativeLabCheck($cart->add(),'Cannot create rounding cart.');$context->cart=$cart;
  foreach($ids as $id)nativeLabCheck($cart->updateQty(1,$id)>0,'Cannot add rounding line.');
  $cart->setDeliveryOption([(int)$fixture['addressId']=>$fixture['carrierId'].',']);nativeLabCheck($cart->update(),'Cannot select pickup.');
  $total=$cart->getOrderTotal(true,Cart::ONLY_PRODUCTS);$rows=$cart->getProducts(true);
  $components=[];foreach(['products'=>Cart::ONLY_PRODUCTS,'shipping'=>Cart::ONLY_SHIPPING,'discounts'=>Cart::ONLY_DISCOUNTS,'wrapping'=>Cart::ONLY_WRAPPING,'both'=>Cart::BOTH] as $label=>$kind)$components[$label]=['gross'=>sprintf('%.6f',$cart->getOrderTotal(true,$kind)),'net'=>sprintf('%.6f',$cart->getOrderTotal(false,$kind))];
  $orderEvidence=null;$nativeQuote=null;$nativeStock=[];
  if($withOrder){
   Module::getInstanceByName('totuscentralconnector');
   $installation='00000000-0000-4000-8000-000000000001';
   $owner=['verified'=>true,'cart_id'=>(int)$cart->id,'shop_id'=>1,'installation_id'=>$installation,'api_account_id'=>17,'customer_id'=>(int)$customer->id];
   $handler=new \TotusCentralConnector\NativeCartQuote(static fn()=> $owner,new \PrestaShop\PrestaShop\Adapter\ContextStateManager(new \PrestaShop\PrestaShop\Adapter\LegacyContext()));
   $nativeQuote=$handler->execute(['command'=>'cart.quote','shop_id'=>1,'installation_id'=>$installation,'api_account_id'=>17,'payload'=>['cart_id'=>(int)$cart->id]]);
   foreach($ids as $productId)$nativeStock[]=['id'=>(int)StockAvailable::getStockAvailableIdByProductId($productId,0,1),'productId'=>$productId,'attributeId'=>0,'shopId'=>1,'shopGroupId'=>0,'dependsOnStock'=>false,'quantity'=>(int)StockAvailable::getQuantityAvailableByProduct($productId,0,1)];
  }
  if($withOrder){
   $paidCents=(int)round(100*$cart->getOrderTotal(true,Cart::BOTH));
   $order=nativeLabPaidOrder($cart,[['method'=>'Efectivo','amountCents'=>$paidCents]]);
   $invoices=$order->getInvoicesCollection();$invoice=$invoices->getFirst();
   $paymentSum=0;foreach($order->getOrderPaymentCollection() as $payment)$paymentSum+=(int)round(100*$payment->amount);
   nativeLabCheck($paymentSum===$paidCents&&(int)round(100*$order->total_paid_tax_incl)===$paidCents&&(int)round(100*$invoice->total_paid_tax_incl)===$paidCents,'Order, invoice and payment disagree.');
   nativeLabCheck((int)$order->round_type===$type&&(int)$order->round_mode===2,'Historical rounding settings differ.');
   $orderEvidence=['orderId'=>(int)$order->id,'paidCents'=>$paidCents,'orderGross'=>$order->total_paid_tax_incl,'invoiceGross'=>$invoice->total_paid_tax_incl,'invoiceNet'=>$invoice->total_paid_tax_excl,'details'=>array_map(static fn($row)=>array_intersect_key($row,array_flip(['product_id','unit_price_tax_incl','unit_price_tax_excl','total_price_tax_incl','total_price_tax_excl'])),$order->getOrderDetailList()),'taxBreakdown'=>$invoice->getProductTaxesBreakdown($order)];
  }
  $results[]=['roundType'=>$type,'computingPrecision'=>$context->getComputingPrecision(),'subtotal'=>sprintf('%.6f',$total),'netSubtotal'=>sprintf('%.6f',$cart->getOrderTotal(false,Cart::ONLY_PRODUCTS)),'lines'=>array_map(static fn($row)=>['unit'=>sprintf('%.6f',$row['price_wt']),'total'=>sprintf('%.6f',$row['total_wt']),'netTotal'=>sprintf('%.6f',$row['total']),'taxGroup'=>(int)(new Product((int)$row['id_product']))->id_tax_rules_group],$rows)];
  $results[array_key_last($results)]['components']=$components;
  if($mixed){
   $expectedProducts=$type===3?'2.220000':'2.230000';$expectedBoth=$type===1?'2.230000':'2.220000';
   nativeLabCheck($components['products']['gross']===$expectedProducts&&$components['both']['gross']===$expectedBoth,'Native rounding behavior changed: review reconciliation.');
   foreach(['shipping','discounts','wrapping'] as $kind)nativeLabCheck($components[$kind]['gross']==='0.000000'&&$components[$kind]['net']==='0.000000','Fixture is contaminated by fees or discounts.');
  }
  if($withOrder){
   $results[array_key_last($results)]['order']=$orderEvidence;
   if($type===3)$results[array_key_last($results)]['ticketAmounts']=\TotusCentralConnector\NativeDocuments::reconcileTicketTotals($order->getOrderDetailList(),(int)round(100*$order->total_products_wt),(int)round(100*$order->total_products),(int)$order->round_mode);
   $results[array_key_last($results)]['nativeQuote']=$nativeQuote;
   $results[array_key_last($results)]['stockRecords']=$nativeStock;
   $results[array_key_last($results)]['inventory']=array_map(static fn($row)=>['mode'=>'isolated-fixture','productId'=>$row['productId'],'attributeId'=>0,'before'=>$row['quantity'],'after'=>(int)StockAvailable::getQuantityAvailableByProduct($row['productId'],0,1),'ambiguous'=>false],$nativeStock);
   $orderFields=['id','id_shop','id_cart','id_customer','id_address_invoice','id_address_delivery','id_currency','current_state','reference','module','total_paid_tax_incl','total_paid_real','total_shipping_tax_incl','total_discounts_tax_incl','total_products','total_products_wt','round_type','round_mode'];
   $orderFields[]='total_paid_tax_excl';
   $orderData=[];foreach($orderFields as $field)$orderData[$field]=$order->$field;
   $state=new OrderState((int)$order->current_state);$currency=new Currency((int)$order->id_currency);
   $paymentData=[];foreach($order->getOrderPaymentCollection() as $payment)$paymentData[]=['id'=>(int)$payment->id,'order_reference'=>$payment->order_reference,'id_currency'=>(int)$payment->id_currency,'amount'=>$payment->amount,'payment_method'=>$payment->payment_method];
   $results[array_key_last($results)]['readback']=['order'=>$orderData,'state'=>['id'=>(int)$state->id,'paid'=>(bool)$state->paid],'currency'=>['id'=>(int)$currency->id,'iso_code'=>$currency->iso_code],
    'details'=>array_map(static fn($row)=>array_intersect_key($row,array_flip(['id_order','product_id','product_attribute_id','product_quantity','unit_price_tax_incl','unit_price_tax_excl','total_price_tax_incl','total_price_tax_excl'])),$order->getOrderDetailList()),'payments'=>$paymentData];
  }
 }
}finally{Configuration::updateValue('PS_ROUND_TYPE',$originalType);Configuration::updateValue('PS_PRICE_ROUND_MODE',$originalMode);}
foreach($results as $row){
 if($mixed){nativeLabCheck(count($row['lines'])===2&&$row['lines'][0]['taxGroup']!==$row['lines'][1]['taxGroup'],'Mixed tax groups missing.');continue;}
 nativeLabCheck($row['computingPrecision']===2,'Unexpected native precision: review fixture expectations.');
 nativeLabCheck($row['subtotal']===($row['roundType']===3?'2.010000':'2.020000'),'Unexpected native subtotal.');
 nativeLabCheck(count($row['lines'])===2,'Unexpected rounding line count.');
 foreach($row['lines'] as $line)nativeLabCheck($line['unit']==='1.005000'&&$line['total']===($row['roundType']===3?'1.005000':'1.010000'),'Unexpected native line rounding.');
}
$artifact=($withOrder?'rounding-order-':'rounding-cart-').($mixed?'mixed-':'').'probe'.(count($types)===1?'-type'.$types[0]:'').'.json';
file_put_contents($project.'/artifacts/native-lab/'.$artifact,json_encode($results,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
if($mixed){echo json_encode($results,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT).PHP_EOL;exit;}
echo 'PASS actual local PrestaShop: unit/line subtotal2.02, total-rounding subtotal2.01, original six-decimal prices retained; local configuration restored.'.PHP_EOL;
