<?php
// Explicit loopback-only disposable runtime; this file is never packaged.
$host=parse_url('http://'.($_SERVER['HTTP_HOST']??''),PHP_URL_HOST);
if($host!=='127.0.0.1' || !in_array($_SERVER['REMOTE_ADDR']??'', ['127.0.0.1','::1'],true)){http_response_code(403);exit;}
$nativeRoot=realpath(__DIR__.'/../../artifacts/native-lab/shop');
$p=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
if($p['database_host']!=='127.0.0.1' || (string)$p['database_port']!=='3318' || $p['database_name']!=='totus_tpv_lab'){http_response_code(403);exit;}
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
$path=(string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(!str_starts_with($path,'/api/')){http_response_code(404);exit;}
$_GET['url']=substr($path,5);
require $nativeRoot.'/webservice/dispatcher.php';
