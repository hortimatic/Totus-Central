<?php
require __DIR__.'/../connectors/prestashop/src/NativeDocuments.php';
use TotusCentralConnector\NativeDocuments;
foreach(['logo.png','logo-123.JPG','shop_logo.webp'] as $name)if(NativeDocuments::merchantLogoPath($name)!=='/img/'.$name)throw new RuntimeException('Native logo filename rejected');
foreach([false,null,[],42,'../logo.png','https://external.invalid/logo.png','logo.svg','logo.png?secret=1',"logo.png\n",'logo%2fsecret.png','/logo.png'] as $name)
 if(NativeDocuments::merchantLogoPath($name)!==null)throw new RuntimeException('Unsafe native logo path accepted');
echo "PASS native document logo path: public image filenames only; no origin, traversal, active markup or query propagation. Isolated path boundary only.\n";
