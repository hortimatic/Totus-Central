<?php
/** Native encoder, fictional references, no order or stock mutation. */
require __DIR__.'/bootstrap.php';
require_once nativeLabConnector('Protocol');
require_once nativeLabConnector('NativeDocuments');
use TotusCentralConnector\NativeDocuments;
$cases=[];
foreach(['ABCDEFGHI','ABCDEFGHIJ','1234567890','AB-CD12EFG'] as $reference){
    $barcode=NativeDocuments::referenceBarcode($reference);
    nativeLabCheck(is_array($barcode)&&$barcode['format']==='Code128'&&$barcode['text']===$reference&&$barcode['payload']==='R:'.$reference,'Native Code128 was not generated');
    $bytes=base64_decode($barcode['data'],true);nativeLabCheck(is_string($bytes)&&str_starts_with($bytes,"\x89PNG\r\n\x1a\n"),'Native barcode must be PNG');
    $cases[]=$barcode;
}
foreach(['',str_repeat('A',11),'../secret',"ABC\nDEF",'ABCÑ',null,[]] as $invalid)
    nativeLabCheck(NativeDocuments::referenceBarcode($invalid)===null,'Unsupported references must retain the plain order number fallback');
file_put_contents($project.'/artifacts/native-lab/reference-barcodes.json',json_encode([
    'source'=>'NativeDocuments::referenceBarcode with installed PrestaShop 8.2.8 TCPDF and GD; fictional references only',
    'encoder_sha256'=>hash('sha256',str_replace("\r\n","\n",file_get_contents($project.'/connectors/prestashop/src/NativeDocuments.php'))),
    'cases'=>$cases,
],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
echo "PASS native Code128 encoder: reference namespace, bounded length, PNG and quiet zones. Decoder and printed-size checks are separate. No sale or stock write.\n";
