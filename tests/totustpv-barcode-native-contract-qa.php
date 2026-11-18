<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeBarcodes.php';
use TotusCentralConnector\NativeBarcodes as B;
function check($ok){if(!$ok)throw new RuntimeException('Barcode assertion failed');}
check(B::checkDigit('400638133393')==='1');check(B::candidate('ean13',1)==='0400000000022');check(B::candidate('upc',1)==='400000000022');
check(B::codeKey(B::candidate('ean13',1))===B::codeKey(B::candidate('upc',1)));
foreach(['ean13','upc','reference'] as $field)foreach([1,2147483647] as $id)foreach([0,2147483647] as $aid)foreach([0,999,1000,2147483647] as $attempt){$code=B::candidate($field,$id,$aid,$attempt);check(strlen($code)<=64);check(B::matchesCandidate($field,$id,$aid,$code));if($field!=='reference')check(B::checkDigit(substr($code,0,-1))===substr($code,-1));}
foreach([['ean13',0],['upc',2147483648],['reference',1,-1],['ean13',1,0,2147483648]] as $args){$rejected=false;try{B::candidate(...$args);}catch(InvalidArgumentException $e){$rejected=true;}check($rejected);}
check(!B::matchesCandidate('ean13',1,0,'0400000000029'));check(!B::matchesCandidate('reference',1,0,'TTPV-P0000000001-2147483648'));check(!B::matchesCandidate('upc',1,0,'400000000023'));
echo "PASS native barcode pure contract\n";
