<?php
require __DIR__.'/bootstrap.php';
$product=(int)($argv[1]??0);nativeLabCheck($product>0,'Synthetic product required.');
$s=Db::getInstance()->getLink()->prepare('SELECT quantity,physical_quantity,reserved_quantity FROM `'._DB_PREFIX_.'stock_available` WHERE id_product=? AND id_product_attribute=0 AND id_shop=1');
$s->execute([$product]);$row=$s->fetch(PDO::FETCH_ASSOC);nativeLabCheck($row!==false,'Native fixture stock missing.');
echo json_encode(array_map('intval',$row),JSON_THROW_ON_ERROR)."\n";
