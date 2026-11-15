<?php
/** Test-only payment module and native sale helper, never a deployed module. */
require_once __DIR__.'/bootstrap.php';
require_once $nativeRoot.'/app/AppKernel.php';
if(!isset($kernel)||!($kernel instanceof AppKernel)){$kernel=new AppKernel('prod',false);$kernel->boot();}
class TotusPaymentFixture extends PaymentModule {
    public function __construct(){
        $this->name='totusnativefixture';$this->version='0.0.1';$this->author='Totus local test';
        parent::__construct();$this->active=true; // Fixture only; no module installed in a web.
    }
}
function nativeLabState(string $name,bool $paid,bool $delivered=false): OrderState {
    $state=new OrderState();$state->name=[(int)Context::getContext()->language->id=>$name];
    $state->logable=$paid;$state->invoice=$paid;$state->send_email=false;$state->paid=$paid;
    $state->delivery=$delivered;$state->shipped=$delivered;$state->color='#555555';
    nativeLabCheck($state->add(),'Cannot create isolated native fixture state.');return $state;
}
function nativeLabPaidOrder(Cart $cart,array $payments,bool $delivered=false): Order {
    nativeLabCheck(Validate::isLoadedObject($cart)&&!$cart->OrderExists(),'Refusing to resend a fixture cart.');
    $context=Context::getContext();$context->cart=$cart;$context->customer=new Customer((int)$cart->id_customer);
    $context->country=new Country((int)(new Address((int)$cart->id_address_delivery))->id_country);
    $cart->getProducts(true);$cart->getPackageList(true);$cart->getDeliveryOptionList($context->country,true);
    $totalCents=(int)round(100*$cart->getOrderTotal(true,Cart::BOTH));
    nativeLabCheck(array_sum(array_column($payments,'amountCents'))===$totalCents,'Local allocations differ from native total.');
    $preparing=nativeLabState('Totus local preparing',false);
    $module=new TotusPaymentFixture();
    $module->validateOrder((int)$cart->id,(int)$preparing->id,$totalCents/100,count($payments)>1?'Mixto':$payments[0]['method'],
        null,[],(int)$cart->id_currency,false,$cart->secure_key,new Shop((int)$cart->id_shop));
    $order=new Order((int)$module->currentOrder);
    nativeLabCheck(Validate::isLoadedObject($order),'Native fixture order missing.');
    nativeLabCheck(count($order->getOrderPaymentCollection())===0,'Unexpected automatic initial payment.');
    foreach($payments as $allocation){
        nativeLabCheck(in_array($allocation['method'],['Efectivo','Tarjeta'],true)&&is_int($allocation['amountCents'])&&$allocation['amountCents']>0,'Invalid local payment.');
        nativeLabCheck($order->addOrderPayment($allocation['amountCents']/100,$allocation['method'],
            'TOTUS-LOCAL-'.$cart->id.'-'.$allocation['method'],new Currency((int)$cart->id_currency)),'Native allocation failed.');
    }
    $paid=nativeLabState('Totus local paid'.($delivered?' and handed over':''),true,$delivered);
    $history=new OrderHistory();$history->id_order=(int)$order->id;
    $history->changeIdOrderState((int)$paid->id,$order,true);
    nativeLabCheck($history->add(),'Native paid state did not persist.');
    $order=new Order((int)$order->id);
    nativeLabCheck(count($order->getOrderPaymentCollection())===count($payments),'Native paid transition duplicated allocations.');
    nativeLabCheck(count($order->getInvoicesCollection())===1,'Native fixture invoice missing.');
    return $order;
}
