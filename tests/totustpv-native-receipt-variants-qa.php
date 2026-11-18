<?php
require __DIR__.'/../connectors/prestashop/src/NativeCartQuote.php';
require __DIR__.'/../connectors/prestashop/src/NativeDocuments.php';
use TotusCentralConnector\NativeCartQuote;
use TotusCentralConnector\NativeDocuments;
$product=['name'=>'Camiseta (edición especial)','attributes'=>'Color : Rojo, Talla : M'];
$snapshot=NativeCartQuote::linePresentation($product);
if($snapshot!==['base_name'=>$product['name'],'variant_name'=>$product['attributes']])throw new RuntimeException('Separate native fields were not preserved');
$sale=['line_presentations'=>[['product_id'=>12,'attribute_id'=>7,'presentation'=>$snapshot]]];
$line=['product_id'=>12,'product_attribute_id'=>7,'product_name'=>'Historical full native title'];
$product['name']='New catalogue title';$product['attributes']='Color : Azul';
if(NativeDocuments::historicalLinePresentation($sale,$line)!==$snapshot)throw new RuntimeException('Later catalogue mutation changed historical presentation');
if(NativeCartQuote::linePresentation($product,'Nombre del operador')['base_name']!=='Nombre del operador')throw new RuntimeException('Operator name lost');
foreach([[],['name'=>12],['name'=>''],['name'=>"Broken\nname"],['name'=>'Ok','attributes'=>[]],['name'=>str_repeat('x',513)]] as $invalid)
 if(NativeCartQuote::linePresentation($invalid)!==null)throw new RuntimeException('Invalid printable snapshot accepted');
foreach([[],['line_presentations'=>'invalid'],['line_presentations'=>[['product_id'=>99,'attribute_id'=>7,'presentation'=>$snapshot]]],['line_presentations'=>array_merge($sale['line_presentations'],$sale['line_presentations'])]] as $legacy)
 if(NativeDocuments::historicalLinePresentation($legacy,$line)!==[])throw new RuntimeException('Legacy/foreign/ambiguous metadata invented');
echo "PASS native receipt variant snapshot: separate base/variant text, custom names, catalogue changes cannot rewrite history, legacy and ambiguous snapshots retain original order title. Pure boundary only; no installed runtime or writes.\n";
