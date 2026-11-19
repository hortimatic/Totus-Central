<?php
// Actual installed PrestaShop validator; no database, order or message write.
require __DIR__.'/../../artifacts/native-lab/shop/classes/Validate.php';
class_alias(ValidateCore::class,'Validate');
require __DIR__.'/../../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../../connectors/prestashop/src/NativeSaleNote.php';
require __DIR__.'/../../connectors/prestashop/src/NativeSale.php';
// No Cart/Order/Db runtime is loaded: an incompatible owned note must be
// refused before any of those financial objects can even be constructed.
class PaymentModule {}
use TotusCentralConnector\NativeSaleNote;
foreach(['javascript:alert(1)','onload=avisar','ONERROR = avisar',"Texto\u{202E}privado"] as $text){
 if(Validate::isCleanHtml($text))throw new RuntimeException('Expected native rejection');
 try{NativeSaleNote::assertMessageCompatible($text);throw new RuntimeException('Missing rejection');}
 catch(InvalidArgumentException $error){if(!str_contains($error->getMessage(),'SALE_NOTE_INVALID'))throw $error;}
 $fingerprint=str_repeat('a',64);
 $sale=new TotusCentralConnector\NativeSale(
  static fn()=>['verified'=>true,'quote_fingerprint'=>$fingerprint,'quote'=>['cart_id'=>1,'shop_id'=>1,'lines'=>[],'sale_note_hash'=>hash('sha256',$text)]],
  static fn()=>['verified'=>true,'sale_note'=>$text],new PaymentModule(),
  ['preparing_state_id'=>1,'paid_state_id'=>2,'payment_labels'=>['cash'=>'Efectivo']]);
 try{$sale->execute(['command'=>'sale.commit','shop_id'=>1,'payload'=>['cart_id'=>1,'quote_operation_id'=>'11111111-1111-4111-8111-111111111111','quote_fingerprint'=>$fingerprint,'payments'=>[['method'=>'cash','amount_cents'=>100,'received_cents'=>100]]]]);throw new RuntimeException('Missing sale preflight rejection');}
 catch(InvalidArgumentException $error){if(!str_contains($error->getMessage(),'SALE_NOTE_INVALID'))throw $error;}
}
foreach([null,'0',"Entrega el miércoles\nAvisar 🙂",'Llamar antes de entregar'] as $text){
 if(NativeSaleNote::assertMessageCompatible($text)!==$text)throw new RuntimeException('Valid private text was changed');
}
echo "PASS private note preflight uses the actual native Message validator; incompatible text rejected before financial objects, ordinary text and literal zero preserved. No writes; owned-sale inputs are fixtures.\n";
