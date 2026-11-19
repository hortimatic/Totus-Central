<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeSale.php';
use TotusCentralConnector\NativeSale;
foreach(['OP-0042','BANK/2026:18','12345678'] as $reference)if(NativeSale::externalReference($reference)!==$reference)throw new RuntimeException('Reference changed');
foreach([null,42,'',' OP-0042','x'.str_repeat('a',64),"x\n",'<x>','4111 1111 1111 1111','CARD-5555-5555-5555-4444'] as $invalid){
 $refused=false;try{NativeSale::externalReference($invalid);}catch(Throwable $error){$refused=str_contains($error->getMessage(),'SALE_PAYMENT_REFERENCE_INVALID');}
 if(!$refused)throw new RuntimeException('Invalid/card data reference accepted');
}
echo "PASS native external reference boundary: canonical ASCII annotations preserved, invalid values and potential card numbers refused. No bank proof or native order is created.\n";
