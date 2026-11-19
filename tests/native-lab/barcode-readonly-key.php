<?php
require __DIR__.'/bootstrap.php';nativeLabKernel();
$context->employee=new Employee(1);$key=new WebserviceKey();$key->key=bin2hex(random_bytes(16));$key->active=true;$key->description='Disposable Totus barcode read-only QA';
nativeLabCheck($key->add(),'Cannot create synthetic read-only barcode key');
nativeLabCheck(WebserviceKey::setPermissionForAccount((int)$key->id,['totus_tpv_barcodes'=>['GET'=>true]]),'Cannot scope synthetic barcode key');
echo json_encode(['key'=>$key->key,'id'=>(int)$key->id],JSON_THROW_ON_ERROR)."\n";
