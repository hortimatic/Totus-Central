<?php
/** Native local scenario. No bank refund; payment module/ownership are fixtures. */
require __DIR__.'/cart-quote.php'; // Creates a fresh disposable cart; never reuses a remote order.
require_once $nativeRoot.'/app/AppKernel.php';
$kernel=new AppKernel('prod',false);$kernel->boot();
$context->employee=new Employee(1);
$context->country=new Country($countryId);
nativeLabCheck($cart->updateQty(1,(int)$product->id)>0,'Cannot add second local unit.');
nativeLabCheck(abs($cart->getOrderTotal(true,Cart::BOTH)-16.02)<0.000001,'Unexpected two-unit native total.');
// Quote and edit share this CLI process. Refresh native static package caches
// explicitly; ordinary separate HTTP requests do not share these static caches.
$cart->getPackageList(true);
$cart->getDeliveryOptionList(new Country($countryId),true);
class TotusMixedFixturePayment extends PaymentModule {
    public function __construct(){
        $this->name='totusnativefixture';$this->version='0.0.1';$this->author='Totus local test';
        parent::__construct();$this->active=true;
    }
}
function localState(string $label,bool $paid,bool $delivered): OrderState {
    $state=new OrderState();$state->name=[(int)Context::getContext()->language->id=>$label];
    $state->logable=$paid;$state->invoice=$paid;$state->send_email=false;$state->paid=$paid;
    $state->delivery=$delivered;$state->shipped=$delivered;$state->color='#555555';
    nativeLabCheck($state->add(),'Cannot create isolated local state.');return $state;
}
$preparing=localState('Totus local preparing mixed',false,false);
$module=new TotusMixedFixturePayment();
$module->validateOrder((int)$cart->id,(int)$preparing->id,16.02,'Mixto',null,[],(int)$cart->id_currency,false,$cart->secure_key,new Shop(1));
$order=new Order((int)$module->currentOrder);
nativeLabCheck(Validate::isLoadedObject($order),'Missing local mixed order.');
nativeLabCheck(count($order->getOrderPaymentCollection())===0,'Unexpected automatic initial payment.');
foreach([['Efectivo',5.00],['Tarjeta',11.02]] as [$method,$amount]){
    nativeLabCheck($order->addOrderPayment($amount,$method,'TOTUS-LOCAL-'.$method.'-'.$cart->id,new Currency((int)$cart->id_currency)),'Cannot add native split payment.');
}
$delivered=localState('Totus local paid and handed over',true,true);
$history=new OrderHistory();$history->id_order=(int)$order->id;
$history->changeIdOrderState((int)$delivered->id,$order,true);
nativeLabCheck($history->add(),'Cannot persist delivered native state.');
$order=new Order((int)$order->id);
nativeLabCheck($order->hasBeenDelivered(),'Native delivered state missing.');
nativeLabCheck(count($order->getOrderPaymentCollection())===2,'Native transition duplicated split payments.');
$observed=[];foreach($order->getOrderPaymentCollection() as $payment)$observed[$payment->payment_method]=(int)round(100*(float)$payment->amount);
nativeLabCheck($observed===['Efectivo'=>500,'Tarjeta'=>1102],'Split payment methods or amounts changed.');
nativeLabCheck(count($order->getInvoicesCollection())===1,'Mixed sale invoice missing.');
nativeLabCheck((int)StockAvailable::getQuantityAvailableByProduct((int)$product->id,0,1)===3,'Two-unit sale stock differs.');
$details=$order->getOrderDetailList();nativeLabCheck(count($details)===1,'Unexpected local order detail count.');
$detailId=(int)$details[0]['id_order_detail'];
$bus=$kernel->getContainer()->get('prestashop.core.command_bus');
foreach([false,true] as $restock){
    $command=new PrestaShop\PrestaShop\Core\Domain\Order\Command\IssuePartialRefundCommand(
        (int)$order->id,[$detailId=>['quantity'=>1,'amount'=>'8.01']],'0.00',$restock,true,false,
        PrestaShop\PrestaShop\Core\Domain\Order\VoucherRefundType::PRODUCT_PRICES_REFUND
    );
    $bus->handle($command);
    nativeLabCheck((int)StockAvailable::getQuantityAvailableByProduct((int)$product->id,0,1)===($restock?4:3),
        'Native return restocked a defective unit or missed a resalable one.');
}
$detail=new OrderDetail($detailId);
nativeLabCheck((int)$detail->product_quantity_refunded+(int)$detail->product_quantity_return===2,'Native returned quantity differs.');
nativeLabCheck(abs((float)$detail->total_refunded_tax_incl-16.02)<0.000001,'Native refund total differs.');
$slips=OrderSlip::getOrdersSlip((int)$order->id_customer,(int)$order->id);
nativeLabCheck(count($slips)===2,'Expected two native credit notes.');
$rejected=false;
try {
    $bus->handle(new PrestaShop\PrestaShop\Core\Domain\Order\Command\IssuePartialRefundCommand(
        (int)$order->id,[$detailId=>['quantity'=>1,'amount'=>'8.01']],'0.00',true,true,false,
        PrestaShop\PrestaShop\Core\Domain\Order\VoucherRefundType::PRODUCT_PRICES_REFUND));
} catch(PrestaShop\PrestaShop\Core\Domain\Order\Exception\InvalidCancelProductException $error){$rejected=true;}
nativeLabCheck($rejected,'Native engine accepted more returned units than sold.');
nativeLabCheck(count(OrderSlip::getOrdersSlip((int)$order->id_customer,(int)$order->id))===2,'Rejected return created another credit note.');
file_put_contents($project.'/artifacts/native-lab/latest-mixed-refund.json',json_encode([
    'mode'=>'local-native-fixture','orderId'=>(int)$order->id,'cartId'=>(int)$cart->id,
    'payments'=>$observed,'creditNotes'=>2,'refundedCents'=>1602,'finalStock'=>4,
    'externalMoneyReturned'=>false,'note'=>'Native credit notes do not confirm an external terminal refund or a cash-drawer movement.',
],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR));
echo "PASS actual native mixed sale, one invoice, two partial credit notes, defective/resalable stock rules and excessive-return rejection. External money movements are not exercised.\n";
