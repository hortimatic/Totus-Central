<?php
/** Read-only native customer/address projection from a disposable order. */
require __DIR__.'/bootstrap.php';
require_once nativeLabConnector('Protocol');
require_once nativeLabConnector('NativeDocuments');
use TotusCentralConnector\NativeDocuments;
$fixture=json_decode(file_get_contents($project.'/artifacts/native-lab/latest-card-order.json'),true,16,JSON_THROW_ON_ERROR);
$order=new Order((int)$fixture['orderId']);$customer=new Customer((int)$order->id_customer);
$invoice=new Address((int)$order->id_address_invoice);
$data=NativeDocuments::customerForOrder($order,0);
nativeLabCheck(is_array($data)&&array_keys($data)===['email','invoice','delivery'],'Only printable customer groups may be projected');
nativeLabCheck($data['email']===$customer->email&&$data['invoice']['name']===trim($invoice->firstname.' '.$invoice->lastname),'Native customer and order address must agree');
nativeLabCheck(array_keys($data['invoice'])===['name','company','address1','address2','postcode','city','country','phone','comment'],'No authentication fields or unrelated native properties may escape');
nativeLabCheck(NativeDocuments::customerForOrder($order,(int)$customer->id)===null,'Anonymous counter identity must not be printed as a customer');
$invalid=clone $order;$invalid->id_address_invoice=0;
nativeLabCheck(NativeDocuments::customerForOrder($invalid,0)===null,'Unavailable historical customer details must not break the receipt');
echo "PASS native receipt customer projection: existing order addresses, printable fields only, anonymous counter omitted and missing address tolerated. Disposable local database only.\n";
