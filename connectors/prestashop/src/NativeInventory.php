<?php
namespace TotusCentralConnector;

/** Additive receipt of ordinary stock. Never writes a stale absolute quantity.
 * Native quantity, movement and immutable receipt share one PDO transaction.
 */
final class NativeInventory
{
    private \PDO $db;private $receiptReader;
    public function __construct(\PDO $db,callable $receiptReader){$this->db=$db;$this->receiptReader=$receiptReader;}
    public function execute(array $command): array
    {
        $p=$command['payload']??[];
        Protocol::ensure(($command['command']??null)==='stock.receive'&&count($p)===4&&
            array_diff(array_keys($p),['product_id','attribute_id','quantity','reason'])===[]&&
            is_int($p['product_id']??null)&&$p['product_id']>0&&is_int($p['attribute_id']??null)&&$p['attribute_id']>=0&&
            is_int($p['quantity']??null)&&$p['quantity']>0&&$p['quantity']<=100000&&
            is_string($p['reason']??null)&&trim($p['reason'])!==''&&strlen($p['reason'])<=500&&
            !preg_match('/[\x00-\x1f]/',$p['reason']),'STOCK_RECEIPT_INVALID');
        Protocol::ensure($this->db->inTransaction(),'STOCK_TRANSACTION_REQUIRED');
        $product=new \Product($p['product_id'],false,null,$command['shop_id']);
        Protocol::ensure(\Validate::isLoadedObject($product)&&!$product->advanced_stock_management&&
            !$product->is_virtual&&!\Pack::isPack($p['product_id'])&&$product->isAssociatedToShop($command['shop_id']),
            'STOCK_PRODUCT_UNSUPPORTED');
        if($p['attribute_id']>0){$variant=new \Combination($p['attribute_id']);
            Protocol::ensure(\Validate::isLoadedObject($variant)&&(int)$variant->id_product===$p['product_id'],'STOCK_VARIANT_MISMATCH');
        }else Protocol::ensure(!$product->hasAttributes(),'STOCK_VARIANT_REQUIRED');
        $id=(int)\StockAvailable::getStockAvailableIdByProductId($p['product_id'],$p['attribute_id'],$command['shop_id']);
        $s=$this->db->prepare('SELECT quantity,id_shop,id_shop_group,depends_on_stock FROM `'._DB_PREFIX_.'stock_available` WHERE id_stock_available=? FOR UPDATE');
        $s->execute([$id]);$stock=$s->fetch(\PDO::FETCH_ASSOC);
        Protocol::ensure($stock&&(int)$stock['id_shop']===$command['shop_id']&&(int)$stock['id_shop_group']===0&&
            !$stock['depends_on_stock']&&(int)$stock['quantity']+$p['quantity']<=2147483647,'STOCK_SCOPE_INVALID');
        $reasonId=(int)\Configuration::get('PS_STOCK_MVT_INC_EMPLOYEE_EDITION');$reason=new \StockMvtReason($reasonId);
        Protocol::ensure(\Validate::isLoadedObject($reason)&&(int)$reason->sign===1,'STOCK_REASON_UNAVAILABLE');
        \Cache::clean('*');Protocol::ensure(\StockAvailable::updateQuantity($p['product_id'],$p['attribute_id'],$p['quantity'],$command['shop_id'],false),'STOCK_RECEIVE_FAILED');
        $movement=new \StockMvt();$movement->id_stock=$id;$movement->id_employee=0;
        $movement->employee_firstname='Totus';$movement->employee_lastname='Central';$movement->sign=1;
        $movement->physical_quantity=$p['quantity'];$movement->id_stock_mvt_reason=$reasonId;$movement->price_te=0;
        $movement->date_add=date('Y-m-d H:i:s');Protocol::ensure($movement->add(),'STOCK_MOVEMENT_FAILED');
        (new \PrestaShop\PrestaShop\Adapter\StockManager())->updatePhysicalProductQuantity($command['shop_id'],
            (int)\Configuration::get('PS_OS_ERROR'),(int)\Configuration::get('PS_OS_CANCELED'),$p['product_id']);
        \Cache::clean('*');$after=(int)\StockAvailable::getQuantityAvailableByProduct($p['product_id'],$p['attribute_id'],$command['shop_id']);
        Protocol::ensure($after===(int)$stock['quantity']+$p['quantity'],'STOCK_RECEIPT_READBACK_FAILED');
        return self::verify(['verified'=>true,'native_reference'=>(int)$movement->id,'stock_movement_id'=>(int)$movement->id,
            'stock_id'=>$id,'product_id'=>$p['product_id'],'attribute_id'=>$p['attribute_id'],'shop_id'=>$command['shop_id'],
            'quantity'=>$p['quantity'],'before'=>(int)$stock['quantity'],'after'=>$after,'reason'=>$p['reason']],$command);
    }
    public static function verify(array $receipt,array $scope): array
    {
        $movement=new \StockMvt((int)$receipt['stock_movement_id']);$stock=new \StockAvailable((int)$receipt['stock_id']);
        Protocol::ensure(\Validate::isLoadedObject($movement)&&\Validate::isLoadedObject($stock)&&
            (int)$movement->id_stock===(int)$stock->id&&(int)$movement->sign===1&&
            (int)$movement->physical_quantity===$receipt['quantity']&&(int)$stock->id_shop===$scope['shop_id']&&
            $receipt['shop_id']===$scope['shop_id']&&(int)$stock->id_product===$receipt['product_id']&&
            (int)$stock->id_product_attribute===$receipt['attribute_id'],'STOCK_RECEIPT_READBACK_FAILED');
        return $receipt;
    }
    public function reconcile(array $command,array $claim): ?array
    {$receipt=($this->receiptReader)($command);return $receipt===null?null:self::verify($receipt,$command);}
}
