<?php
/** Native local experiment, not the production connector or a bank charge. */
require __DIR__.'/bootstrap.php';
require_once $nativeRoot.'/app/AppKernel.php';
$kernel=new AppKernel('prod',false);
$kernel->boot();
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-cart.json'),true,512,JSON_THROW_ON_ERROR);
nativeLabCheck(($fixture['mode']??'')==='local-native-fixture','Wrong fixture mode.');
$cart=new Cart((int)$fixture['cartId']);
nativeLabCheck(Validate::isLoadedObject($cart)&&!$cart->OrderExists(),'Fixture cart already dispatched; create a fresh cart fixture instead of retrying.');
$context->cart=$cart;$context->customer=new Customer((int)$cart->id_customer);
$context->country=new Country((int)(new Address((int)$cart->id_address_delivery))->id_country);
class TotusNativeFixturePayment extends PaymentModule {
    public function __construct(){
        $this->name='totusnativefixture';$this->version='0.0.1';$this->author='Totus local test';
        parent::__construct();$this->active=true;
    }
}
$state=new OrderState();$state->name=[(int)$context->language->id=>'Totus local preparing'];
$state->logable=false;$state->invoice=false;$state->send_email=false;$state->paid=false;
$state->delivery=false;$state->shipped=false;$state->color='#555555';
nativeLabCheck($state->add(),'Cannot create local preparing state.');
$module=new TotusNativeFixturePayment();
$module->validateOrder((int)$cart->id,(int)$state->id,8.01,'Tarjeta',null,[],(int)$cart->id_currency,false,$cart->secure_key,new Shop(1));
$order=new Order((int)$module->currentOrder);
nativeLabCheck(Validate::isLoadedObject($order),'Native order missing.');
nativeLabCheck(count($order->getOrderPaymentCollection())===0,'Preparing state created an unexpected payment.');
nativeLabCheck($order->addOrderPayment(8.01,'Tarjeta','TOTUS-LOCAL-CARD-'.$cart->id,new Currency((int)$cart->id_currency)),'Cannot record independent terminal payment.');
$order=new Order((int)$order->id);
$payments=$order->getOrderPaymentCollection();
nativeLabCheck(count($payments)===1,'Expected exactly one native payment.');
foreach($payments as $payment){
    nativeLabCheck($payment->payment_method==='Tarjeta'&&abs((float)$payment->amount-8.01)<0.000001,'Native card payment label or amount differs.');
}
nativeLabCheck((int)StockAvailable::getQuantityAvailableByProduct((int)$fixture['productId'],0,1)===4,'Native sale did not deduct exactly one unit.');
file_put_contents($project.'/artifacts/native-lab/latest-card-order.json',json_encode([
    'mode'=>'local-native-fixture','orderId'=>(int)$order->id,'cartId'=>(int)$cart->id,
    'paymentMethod'=>'Tarjeta','amountCents'=>801,'bankCharged'=>false,
    'status'=>'preparing-only-not-finalized','stock'=>4,
],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "PASS actual local native order + one Tarjeta payment + stock 5 to 4. No bank request; final paid-state transition remains a separate test.\n";
