<?php
/** Continue the existing local fixture; never create another order/payment. */
require __DIR__.'/bootstrap.php';
require_once $nativeRoot.'/app/AppKernel.php';
$kernel=new AppKernel('prod',false);$kernel->boot();
$fixturePath=$project.'/artifacts/native-lab/latest-card-order.json';
$fixture=json_decode(file_get_contents($fixturePath),true,512,JSON_THROW_ON_ERROR);
nativeLabCheck(($fixture['mode']??'')==='local-native-fixture','Wrong fixture mode.');
$order=new Order((int)$fixture['orderId']);
nativeLabCheck(Validate::isLoadedObject($order)&&(int)$order->id_cart===(int)$fixture['cartId'],'Wrong local native order.');
$context->cart=new Cart((int)$order->id_cart);$context->customer=new Customer((int)$order->id_customer);
$context->country=new Country((int)(new Address((int)$order->id_address_delivery))->id_country);
$paidState=(int)Configuration::get('PS_OS_PAYMENT');
if((int)$order->current_state!==$paidState){
    nativeLabCheck($fixture['status']==='preparing-only-not-finalized','Unexpected local order state.');
    $history=new OrderHistory();$history->id_order=(int)$order->id;
    $history->changeIdOrderState($paidState,$order,true);
    nativeLabCheck($history->add(),'Cannot persist native paid history.');
}
$order=new Order((int)$order->id);
nativeLabCheck((int)$order->current_state===$paidState,'Native paid state did not persist.');
nativeLabCheck(count($order->getOrderPaymentCollection())===1,'Paid transition duplicated the independent terminal payment.');
foreach($order->getOrderPaymentCollection() as $payment){
    nativeLabCheck($payment->payment_method==='Tarjeta'&&abs((float)$payment->amount-8.01)<0.000001,'Native card payment changed.');
}
nativeLabCheck(count($order->getInvoicesCollection())===1,'Expected one native invoice.');
$fixture['status']='paid-with-one-native-card-payment';
file_put_contents($fixturePath,json_encode($fixture,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "PASS actual local paid-state transition and one invoice; still exactly one Tarjeta payment of 8.01 EUR. No bank request.\n";
