<?php
/** Synthetic class boundary: no installed shop, orders or stock are modified. */
class OrderCore {
 public $id;public function __construct($id){$this->id=$id;}
 public function hasBeenDelivered(){return $this->id===42;}
 public function hasBeenShipped(){return $this->id===42;}
 public function hasBeenPaid(){return $this->id===42;}
}
class Order extends OrderCore {
 public function hasBeenDelivered(){return false;}
 public function hasBeenShipped(){return false;}
}
require __DIR__.'/../connectors/prestashop/src/NativeReturns.php';
$factory=new ReflectionMethod(TotusCentralConnector\NativeReturns::class,'nativeOrder');
$order=$factory->invoke(null,42);$unpaid=$factory->invoke(null,43);
if(!($order instanceof Order)||!$order->hasBeenDelivered()||!$order->hasBeenShipped()||!$order->hasBeenPaid()||$unpaid->hasBeenDelivered()||$unpaid->hasBeenPaid()||(new Order(42))->hasBeenDelivered())throw new Exception('Scoped native return state boundary failed.');
echo "PASS native return history boundary preserves Order type and leaves global overrides unchanged. Synthetic classes only.\n";
