<?php
/** Read-only native encoder proof; no product, journal or configuration writes. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
require_once $nativeRoot.'/modules/totuscentralconnector/src/Protocol.php';
require_once $nativeRoot.'/modules/totuscentralconnector/src/NativeBarcodes.php';
use TotusCentralConnector\NativeBarcodes;
$samples=[];foreach([['ean13','4006381333931'],['upc','012345678905'],['reference','TTPV-P0000000001'],['reference',str_repeat('X',64)]] as [$field,$code]){
 $pattern=NativeBarcodes::labelPattern($field,$code);nativeLabCheck($pattern!==null,'Native encoder rejected sample '.$field.' length '.strlen($code));$samples[]=['field'=>$field,'code'=>$code]+$pattern;
}
nativeLabCheck(NativeBarcodes::labelPattern('ean13','4006381333939')===null,'Invalid check digit must not print');
nativeLabCheck(NativeBarcodes::labelPattern('reference',"bad\ncode")===null,'Control characters must not print');
echo json_encode($samples,JSON_THROW_ON_ERROR)."\n";
