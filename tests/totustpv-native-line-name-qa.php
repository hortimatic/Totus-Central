<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeOrderLineNames.php';
use TotusCentralConnector\NativeOrderLineNames as Names;
$checks=0;function nameCheck($ok){global $checks;if(!$ok)throw new RuntimeException('Native line-name contract '.($checks+1));$checks++;}
nameCheck(Names::normalize(null)===null);nameCheck(Names::normalize('  ')===null);nameCheck(Names::normalize(' Kit azul 🙂 ')==='Kit azul 🙂');nameCheck(Names::normalize(str_repeat('🙂',255))===str_repeat('🙂',255));
foreach([[],1,true,str_repeat('🙂',256),'<img>','Kit = 2','{kit}',"texto\n","texto\x00","\xc3\x28"] as $name){$refused=false;try{Names::normalize($name);}catch(Throwable $e){$refused=str_contains($e->getMessage(),'LINE_NAME_INVALID');}nameCheck($refused);}
$names=['12:7'=>'Kit azul','12:0'=>'Kit base'];nameCheck(Names::names($names)===['12:0'=>'Kit base','12:7'=>'Kit azul']);
$lines=[['product_id'=>12,'attribute_id'=>7,'display_name'=>'Kit azul'],['product_id'=>12,'attribute_id'=>0,'display_name'=>'Kit base']];Names::assertQuote($names,$lines);nameCheck(true);
foreach([['0:0'=>'Kit'],['01:0'=>'Kit'],['2147483648:0'=>'Kit'],['12:-1'=>'Kit'],['12:0'=>null],['12:0'=>' Kit '],['12:0'=>'']] as $map){$refused=false;try{Names::names($map);}catch(Throwable $e){$refused=str_contains($e->getMessage(),'LINE_NAMES_INVALID');}nameCheck($refused);}
foreach([[...$lines,$lines[0]],[['product_id'=>13,'attribute_id'=>7,'display_name'=>'Kit azul']],[['product_id'=>12,'attribute_id'=>7,'display_name'=>'Otro nombre']]] as $changed){$refused=false;try{Names::assertQuote($names,$changed);}catch(Throwable $e){$refused=true;}nameCheck($refused);}
echo "PASS native line-name contract: {$checks} assertions, Unicode, canonical identities, immutable quote binding and invalid values. No native order or product write.\n";
