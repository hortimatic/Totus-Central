<?php
/** Fault injection into the disposable connector journal only. */
require __DIR__.'/bootstrap.php';
$id=(int)($argv[1]??0);nativeLabCheck($id>0,'Cart ID required.');$db=Db::getInstance()->getLink();
$s=$db->prepare('SELECT p.reference FROM `'._DB_PREFIX_.'cart_product` cp JOIN `'._DB_PREFIX_.'product` p ON p.id_product=cp.id_product WHERE cp.id_cart=?');$s->execute([$id]);$references=$s->fetchAll(PDO::FETCH_COLUMN);
nativeLabCheck(count($references)>0&&array_reduce($references,static fn($ok,$ref)=>$ok&&str_starts_with($ref,'QA-OOSP-'),true),'Only stock-policy QA carts may be interrupted.');
$s=$db->prepare('SELECT c.operation_id,e.result_json FROM `'._DB_PREFIX_.'totus_tpv_carts` c JOIN `'._DB_PREFIX_.'totus_tpv_effects` e ON e.operation_id=c.operation_id AND e.command=\'cart.prepare\' WHERE c.cart_id=?');$s->execute([$id]);$row=$s->fetch(PDO::FETCH_ASSOC);$receipt=$row?json_decode($row['result_json'],true):null;
nativeLabCheck($receipt&&($receipt['cart_id']??null)===$id&&($receipt['allow_out_of_stock']??false)===true,'Expected a committed opted-in QA cart.');
$s=$db->prepare('UPDATE `'._DB_PREFIX_.'totus_tpv_journal` SET status=\'uncertain\',result_json=NULL,error_code=\'TOTUS_LAB_ACK_LOSS\' WHERE request_id=? AND command=\'cart.prepare\'');$s->execute([$row['operation_id']]);nativeLabCheck($s->rowCount()===1,'Expected one original journal claim.');
echo json_encode(['operationId'=>$row['operation_id'],'cartId'=>$id],JSON_THROW_ON_ERROR)."\n";
