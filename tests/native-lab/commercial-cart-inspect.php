<?php
/** Read-only inspection of owned commercial quotation carts, local lab only. */
require __DIR__.'/bootstrap.php';nativeLabKernel();
$product=new Product((int)($argv[1]??0));$cartId=(int)($argv[2]??0);
nativeLabCheck(Validate::isLoadedObject($product)&&str_starts_with($product->reference,'QA-'),'Only local QA products may be inspected.');
$db=Db::getInstance()->getLink();$commercial=null;$orders=0;
if($cartId>0){$cart=new Cart($cartId);nativeLabCheck(Validate::isLoadedObject($cart)&&(int)$cart->id_shop===1,'Only the local QA shop cart may be inspected.');
 $s=$db->prepare('SELECT commercial_only FROM `'._DB_PREFIX_.'totus_tpv_carts` WHERE cart_id=? AND shop_id=1');$s->execute([$cartId]);$flag=$s->fetchColumn();nativeLabCheck($flag!==false,'Cart is not integration owned.');$commercial=(int)$flag===1;
 $s=$db->prepare('SELECT COUNT(*) FROM `'._DB_PREFIX_.'orders` WHERE id_cart=?');$s->execute([$cartId]);$orders=(int)$s->fetchColumn();
}
echo json_encode(['localOnly'=>true,'commercialOnly'=>$commercial,'orders'=>$orders,'stock'=>(int)StockAvailable::getQuantityAvailableByProduct((int)$product->id,0,1)],JSON_THROW_ON_ERROR)."\n";
