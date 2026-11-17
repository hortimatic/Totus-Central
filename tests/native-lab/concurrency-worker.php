<?php
require __DIR__.'/concurrency-runtime.php';
$directory=concurrencyDirectory((string)($argv[1]??''));$slot=filter_var($argv[2]??null,FILTER_VALIDATE_INT);$phase=(string)($argv[3]??'');nativeLabCheck(in_array($slot,[0,1],true)&&in_array($phase,['race','replay'],true),'Invalid concurrency worker arguments.');$config=concurrencyConfig($directory);$runtime=concurrencyRuntime($config,$directory,$phase,$slot);$result=$runtime['runner']->execute($config['sales'][$slot]['command']);
echo json_encode(['slot'=>$slot,'phase'=>$phase,'pid'=>getmypid(),'result'=>$result],JSON_THROW_ON_ERROR)."\n";
