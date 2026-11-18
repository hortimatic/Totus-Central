<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeBilling.php';
class Validate {static function isLoadedObject($object){return $object->id>0;}}
class Currency {public $id=1;public $iso_code='EUR';function __construct($id){$this->id=$id;}}
class Order {
 public $id=10,$id_shop=1,$id_currency=1,$id_lang=1,$id_customer=2,$id_address_invoice=3,$reference='LABORDER';
 public $rows=[];
 function getOrderDetailList(){return $this->rows;}
}
class OrderInvoice {
 public $id=20,$id_order=10,$number=30,$date_add='2026-11-18 00:00:00';
 public $total_paid_tax_incl='12.10',$total_paid_tax_excl='10.00';
 public $total_discount_tax_incl='0',$total_discount_tax_excl='0',$total_shipping_tax_incl='0',$total_shipping_tax_excl='0';
 function getInvoiceNumberFormatted($lang,$shop){return 'LAB-000030';}
}
use TotusCentralConnector\NativeBilling;
$checks=0;
function check($ok){global $checks;++$checks;if(!$ok)throw new RuntimeException('Billing contract failed at '.$checks);}
function denied($callback,$reason){try{$callback();}catch(Throwable $e){check($e->getMessage()==='TOTUS_'.$reason);return;}check(false);}
$order=new Order();$invoice=new OrderInvoice();$sale=['order_id'=>10,'invoice_ids'=>[20],'total_cents'=>1210];$profile=['shop_id'=>1];
$order->rows=[['id_order'=>10,'id_order_invoice'=>20,'id_order_detail'=>40,'product_id'=>50,'product_quantity'=>2,
 'product_name'=>'Artículo histórico','unit_price_tax_excl'=>'5','unit_price_tax_incl'=>'6.05',
 'total_price_tax_excl'=>'10','total_price_tax_incl'=>'12.10','tax_rate'=>'21','ecotax'=>'0','ecotax_tax_rate'=>'0']];
$before=serialize([$order,$invoice,$sale]);$result=NativeBilling::invoice($order,$invoice,$sale,$profile);
check($before===serialize([$order,$invoice,$sale]));check($result['existing_document']===true);
check($result['lines'][0]['recorded_tax_rate']==='21.000000');check($result['lines'][0]['unit_tax_incl']==='6.050000');
check($result['total_cents']===1210);check($result['number']===30);check($result['formatted_number']==='LAB-000030');
denied(fn()=>NativeBilling::invoice($order,$invoice,$sale,['shop_id'=>2]),'BILLING_INVOICE_OWNERSHIP_REQUIRED');
denied(fn()=>NativeBilling::invoice($order,$invoice,array_replace($sale,['invoice_ids'=>[21]]),$profile),'BILLING_INVOICE_OWNERSHIP_REQUIRED');
denied(fn()=>NativeBilling::invoice($order,$invoice,array_replace($sale,['total_cents'=>1]),$profile),'BILLING_TOTAL_MISMATCH');
$order->rows[0]['id_order_invoice']=21;
denied(fn()=>NativeBilling::invoice($order,$invoice,$sale,$profile),'BILLING_LINE_OWNERSHIP_REQUIRED');
$order->rows[0]['id_order_invoice']=20;$order->rows[0]['tax_rate']=null;
denied(fn()=>NativeBilling::invoice($order,$invoice,$sale,$profile),'BILLING_AMOUNT_INVALID');
$order->rows[0]['tax_rate']='21';$order->rows[0]['product_name']="bad\x00name";
denied(fn()=>NativeBilling::invoice($order,$invoice,$sale,$profile),'BILLING_TEXT_INVALID');
echo "PASS $checks native billing checks: historical values, immutable issued document, ownership, amount and invalid-data rejection.\n";
