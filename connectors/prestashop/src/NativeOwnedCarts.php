<?php
namespace TotusCentralConnector;

/** Ownership is persisted on the native connection, with native Cart writes.
 * This repository never adopts an existing website/customer cart.
 */
final class NativeOwnedCarts
{
    private \PDO $db;
    private string $table;
    private string $journalTable;
    private ?string $effectsTable;
    private array $profile;
    public static function supportsLineNames(): bool{return true;}
    public static function ensureCommercialStorage(\PDO $db,string $table): void
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1&&!$db->inTransaction(),'CART_STORE_CONFIG_INVALID');
        $columns=$db->query('SHOW COLUMNS FROM `'.$table.'` LIKE \'commercial_only\'');
        if(!$columns->fetch(\PDO::FETCH_ASSOC))$db->exec('ALTER TABLE `'.$table.'` ADD COLUMN commercial_only TINYINT(1) NOT NULL DEFAULT 0');
    }
    public static function supportsCommercialQuotes(): bool
    {
        foreach([NativeCartQuote::class,NativeSale::class] as $class)if(!class_exists($class)||!method_exists($class,'supportsCommercialQuotes')||!$class::supportsCommercialQuotes())return false;
        if(!class_exists('Db')||!defined('_DB_PREFIX_'))return false;
        $db=\Db::getInstance()->getLink();if(!$db instanceof \PDO)return false;
        return (bool)$db->query('SHOW COLUMNS FROM `'._DB_PREFIX_.'totus_tpv_carts` LIKE \'commercial_only\'')->fetch(\PDO::FETCH_ASSOC);
    }
    public function __construct(\PDO $db,string $table,string $journalTable,array $profile,?string $effectsTable=null)
    {
        foreach (array_filter([$table,$journalTable,$effectsTable],static fn($name)=>$name!==null) as $name)Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$name)===1,'CART_STORE_CONFIG_INVALID');
        foreach (['currency_id','language_id','carrier_id'] as $key)Protocol::ensure(is_int($profile[$key]??null)&&$profile[$key]>0,'CART_PROFILE_INVALID');
        $this->db=$db;$this->table='`'.$table.'`';$this->journalTable='`'.$journalTable.'`';$this->profile=$profile;
        $this->effectsTable=$effectsTable===null?null:'`'.$effectsTable.'`';
    }
    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'CART_STORE_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (operation_id CHAR(36) NOT NULL PRIMARY KEY,
            installation_id CHAR(36) NOT NULL,api_account_id BIGINT UNSIGNED NOT NULL,
            shop_id BIGINT UNSIGNED NOT NULL,actor_id CHAR(36) NOT NULL,
            session_id CHAR(36) NOT NULL,drawer_id CHAR(36) NOT NULL,
            customer_id BIGINT UNSIGNED NOT NULL,cart_id BIGINT UNSIGNED NOT NULL UNIQUE,commercial_only TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
    public function owner(int $cartId,array $command): array
    {
        $statement=$this->db->prepare('SELECT * FROM '.$this->table.' WHERE cart_id=:cart');
        $statement->execute(['cart'=>$cartId]);$row=$statement->fetch(\PDO::FETCH_ASSOC);
        Protocol::ensure($row && $row['installation_id']===$command['installation_id'] &&
            (int)$row['api_account_id']===$command['api_account_id'] && (int)$row['shop_id']===$command['shop_id'] &&
            $row['actor_id']===$command['actor_id'],'CART_OWNERSHIP_REQUIRED');
        foreach (['cart_id','shop_id','api_account_id','customer_id'] as $key)$row[$key]=(int)$row[$key];
        // A committed effect remains authoritative if the independent journal's
        // completion acknowledgement was lost. Both immutable scopes must match.
        $sql=$this->effectsTable===null?
            'SELECT result_json FROM '.$this->journalTable.' WHERE request_id=:request AND command=\'cart.prepare\' AND status=\'completed\' AND installation_id=:installation AND api_account_id=:account AND shop_id=:shop AND actor_id=:actor':
            'SELECT e.result_json FROM '.$this->effectsTable.' e JOIN '.$this->journalTable.' j ON j.request_id=e.operation_id AND j.fingerprint=e.fingerprint AND j.command=e.command AND j.installation_id=e.installation_id AND j.api_account_id=e.api_account_id AND j.shop_id=e.shop_id AND j.actor_id=e.actor_id WHERE e.operation_id=:request AND e.command=\'cart.prepare\' AND e.installation_id=:installation AND e.api_account_id=:account AND e.shop_id=:shop AND e.actor_id=:actor';
        $policy=$this->db->prepare($sql);
        $policy->execute(['request'=>$row['operation_id'],'installation'=>$row['installation_id'],'account'=>$row['api_account_id'],'shop'=>$row['shop_id'],'actor'=>$row['actor_id']]);$prepared=$policy->fetchColumn();$allow=false;$note=null;$lineNames=[];$commercial=(int)($row['commercial_only']??0)===1;
        if(is_string($prepared)){$result=json_decode($prepared,true,32,JSON_THROW_ON_ERROR);$valid=($result['verified']??false)===true&&($result['cart_id']??null)===$cartId&&($result['session_id']??null)===$row['session_id']&&($result['drawer_id']??null)===$row['drawer_id'];if($valid)Protocol::ensure((($result['commercial_only']??false)===true)===$commercial,'CART_COMMERCIAL_OWNERSHIP_MISMATCH');$allow=$valid&&($result['allow_out_of_stock']??false)===true;if($valid&&array_key_exists('sale_note',$result))$note=NativeSaleNote::normalize($result['sale_note']);if($valid&&array_key_exists('line_names',$result))$lineNames=NativeOrderLineNames::names($result['line_names']);}
        return array_merge($row,['verified'=>true,'allow_out_of_stock'=>$allow,'commercial_only'=>$commercial],$note===null?[]:['sale_note'=>$note],$lineNames?['line_names'=>$lineNames]:[]);
    }
    public function quote(string $operationId,array $command): array
    {
        Protocol::ensure(Protocol::uuid($operationId),'QUOTE_OPERATION_INVALID');
        $statement=$this->db->prepare('SELECT * FROM '.$this->journalTable.' WHERE request_id=:operation');
        $statement->execute(['operation'=>$operationId]);$row=$statement->fetch(\PDO::FETCH_ASSOC);
        Protocol::ensure($row && $row['status']==='completed' && $row['command']==='cart.quote' &&
            $row['installation_id']===$command['installation_id'] && (int)$row['api_account_id']===$command['api_account_id'] &&
            (int)$row['shop_id']===$command['shop_id'] && $row['actor_id']===$command['actor_id'],'QUOTE_OWNERSHIP_REQUIRED');
        return json_decode($row['result_json'],true,32,JSON_THROW_ON_ERROR);
    }
    public function execute(array $command): array
    {
        $p=$command['payload']??[];
        Protocol::ensure(($command['command']??null)==='cart.prepare' && count($p)>=6 && count($p)<=11 &&
            array_diff(array_keys($p),['session_id','drawer_id','customer_id','invoice_address_id','delivery_address_id','lines','adjustment','coupon','allow_out_of_stock','sale_note','commercial_only'])===[] &&
            (!array_key_exists('allow_out_of_stock',$p)||is_bool($p['allow_out_of_stock'])) &&
            Protocol::uuid($p['session_id']??null) && Protocol::uuid($p['drawer_id']??null),'CART_PREPARE_INVALID');
        Protocol::ensure(!array_key_exists('commercial_only',$p)||is_bool($p['commercial_only']),'CART_COMMERCIAL_MODE_INVALID');$commercial=($p['commercial_only']??false)===true;if($commercial)Protocol::ensure(self::supportsCommercialQuotes(),'CART_COMMERCIAL_STORAGE_REQUIRED');
        $note=array_key_exists('sale_note',$p)?NativeSaleNote::assertMessageCompatible($p['sale_note']):null;Protocol::ensure(!array_key_exists('sale_note',$p)||is_string($p['sale_note'])&&$note!==null&&$note===$p['sale_note'],'SALE_NOTE_INVALID');
        foreach (['customer_id','invoice_address_id','delivery_address_id'] as $key)Protocol::ensure(is_int($p[$key]??null)&&$p[$key]>0,'CART_NATIVE_IDENTITY_INVALID');
        Protocol::ensure(is_array($p['lines']??null) && array_is_list($p['lines']) && count($p['lines'])>0 && count($p['lines'])<=200,'CART_LINES_INVALID');
        if(!$commercial)foreach($p['lines'] as $line){
            Protocol::ensure(is_array($line)&&is_int($line['product_id']??null)&&$line['product_id']>0,'CART_LINE_INVALID');
            $forSale=new \Product($line['product_id'],false,null,$command['shop_id']);
            Protocol::ensure(\Validate::isLoadedObject($forSale)&&$forSale->isAssociatedToShop($command['shop_id'])&&$forSale->active&&$forSale->available_for_order,'CART_PRODUCT_DISABLED');
        }
        $lineNames=array_filter($p['lines'],static fn($line)=>is_array($line)&&array_key_exists('display_name',$line))?NativeOrderLineNames::fromLines($p['lines']):[];
        $customer=new \Customer($p['customer_id']);$invoice=new \Address($p['invoice_address_id']);$delivery=new \Address($p['delivery_address_id']);
        Protocol::ensure(\Validate::isLoadedObject($customer) && $customer->active && !$customer->deleted &&
            NativeCustomers::inShop($customer,(int)$command['shop_id']) &&
            \Validate::isLoadedObject($invoice) && !$invoice->deleted && (int)$invoice->id_customer===(int)$customer->id &&
            \Validate::isLoadedObject($delivery) && !$delivery->deleted && (int)$delivery->id_customer===(int)$customer->id,'CART_NATIVE_IDENTITY_INVALID');
        $context=\Context::getContext();$previous=get_object_vars($context);$previousShop=\Shop::getContextShopID();$previousType=\Shop::getContext();
        try {
            $context->shop=new \Shop($command['shop_id']);\Shop::setContext(\Shop::CONTEXT_SHOP,$command['shop_id']);
            $context->customer=$customer;$context->currency=new \Currency($this->profile['currency_id']);
            $context->language=new \Language($this->profile['language_id']);$context->country=new \Country((int)$delivery->id_country);
            $carrier=new \Carrier($this->profile['carrier_id']);
            $privatePickup=$carrier->is_module && $carrier->external_module_name==='totuscentralconnector';
            Protocol::ensure(\Validate::isLoadedObject($carrier) && $carrier->active && !$carrier->deleted &&
                (($carrier->is_free&&!$carrier->is_module)||$privatePickup),'CART_PICKUP_CARRIER_REQUIRED');
            $cart=new \Cart();$cart->id_shop=$command['shop_id'];$cart->id_shop_group=(int)$context->shop->id_shop_group;
            $cart->id_customer=(int)$customer->id;$cart->id_address_invoice=(int)$invoice->id;$cart->id_address_delivery=(int)$delivery->id;
            $cart->id_currency=$this->profile['currency_id'];$cart->id_lang=$this->profile['language_id'];
            $cart->id_carrier=(int)$carrier->id;$cart->secure_key=$customer->secure_key;$cart->gift=false;$cart->recyclable=false;
            $cart->allow_seperated_package=false;
            Protocol::ensure($cart->add(),'CART_NATIVE_CREATE_FAILED');$context->cart=$cart;$seen=[];
            foreach ($p['lines'] as $line) {
                Protocol::ensure(is_array($line) && count($line)>=3 && count($line)<=5 && array_diff(array_keys($line),['product_id','attribute_id','quantity','discount','display_name'])===[] &&
                    is_int($line['product_id']??null) && $line['product_id']>0 &&
                    is_int($line['attribute_id']??null) && $line['attribute_id']>=0 &&
                    is_int($line['quantity']??null) && $line['quantity']>0 && $line['quantity']<=10000,'CART_LINE_INVALID');
                $key=$line['product_id'].':'.$line['attribute_id'];Protocol::ensure(!isset($seen[$key]),'CART_LINE_DUPLICATE');$seen[$key]=true;
                if($commercial){$commercialProduct=new \Product($line['product_id'],false,(int)$context->language->id,$command['shop_id']);Protocol::ensure(\Validate::isLoadedObject($commercialProduct)&&$commercialProduct->isAssociatedToShop($command['shop_id']),'CART_PRODUCT_SHOP_REQUIRED');}
                if($line['attribute_id']>0){$variant=new \Combination($line['attribute_id']);Protocol::ensure(\Validate::isLoadedObject($variant)&&(int)$variant->id_product===$line['product_id']&&(!$commercial||$variant->isAssociatedToShop($command['shop_id'])),'CART_VARIANT_MISMATCH');}
                else{$product=new \Product($line['product_id'],false,(int)$context->language->id,$command['shop_id']);
                    Protocol::ensure(\Validate::isLoadedObject($product)&&!$product->hasAttributes(),'CART_VARIANT_REQUIRED');}
                Protocol::ensure($cart->updateQty($line['quantity'],$line['product_id'],$line['attribute_id'],false,'up',(int)$delivery->id,$context->shop,true,$commercial||($p['allow_out_of_stock']??false)===true)>0,'CART_NATIVE_LINE_FAILED');
            }
            $cart->setDeliveryOption([(int)$delivery->id=>$carrier->id.',']);Protocol::ensure($cart->update(),'CART_NATIVE_UPDATE_FAILED');
            Protocol::ensure((float)$cart->getOrderTotal(true,\Cart::ONLY_SHIPPING)===0.0,'CART_PICKUP_HAS_SHIPPING');
            NativeLineAdjustments::apply($cart,$p['lines']);
            NativeCartAdjustments::apply($cart,$p,$command);
            $statement=$this->db->prepare('INSERT INTO '.$this->table.'
                (operation_id,installation_id,api_account_id,shop_id,actor_id,session_id,drawer_id,customer_id,cart_id'.($commercial?',commercial_only':'').')
                VALUES (:operation,:installation,:account,:shop,:actor,:session,:drawer,:customer,:cart'.($commercial?',:commercial':'').')');
            $statement->execute(['operation'=>$command['operation_id'],'installation'=>$command['installation_id'],
                'account'=>$command['api_account_id'],'shop'=>$command['shop_id'],'actor'=>$command['actor_id'],
                'session'=>$p['session_id'],'drawer'=>$p['drawer_id'],'customer'=>$p['customer_id'],'cart'=>(int)$cart->id,...($commercial?['commercial'=>1]:[])]);
            return ['verified'=>true,'native_reference'=>(int)$cart->id,'cart_id'=>(int)$cart->id,
                'session_id'=>$p['session_id'],'drawer_id'=>$p['drawer_id'],...($commercial?['commercial_only'=>true]:[]),...($note===null?[]:['sale_note'=>$note]),...($lineNames?['line_names'=>$lineNames]:[]),...(($p['allow_out_of_stock']??false)===true?['allow_out_of_stock'=>true]:[])];
        } finally {
            foreach (['shop','cart','customer','currency','language','country'] as $key)$context->$key=$previous[$key]??null;
            \Shop::setContext($previousType,$previousShop);
        }
    }
    public function reconcile(array $command,array $claim): ?array
    {
        $statement=$this->db->prepare('SELECT cart_id FROM '.$this->table.' WHERE operation_id=:operation');
        $statement->execute(['operation'=>$command['operation_id']]);$id=(int)$statement->fetchColumn();if($id===0)return null;
        $owner=$this->owner($id,$command);$cart=new \Cart($id);
        Protocol::ensure(\Validate::isLoadedObject($cart) && (int)$cart->id_customer===$owner['customer_id'],'CART_NATIVE_READBACK_FAILED');
        $payload=$command['payload']??[];
        Protocol::ensure(!array_key_exists('allow_out_of_stock',$payload)||is_bool($payload['allow_out_of_stock']),'CART_PREPARE_INVALID');
        return ['verified'=>true,'native_reference'=>$id,'cart_id'=>$id,'session_id'=>$owner['session_id'],'drawer_id'=>$owner['drawer_id'],...(($owner['commercial_only']??false)===true?['commercial_only'=>true]:[]),...(isset($owner['sale_note'])?['sale_note'=>$owner['sale_note']]:[]),...(!empty($owner['line_names'])?['line_names'=>$owner['line_names']]:[]),...(($payload['allow_out_of_stock']??$owner['allow_out_of_stock']??false)===true?['allow_out_of_stock'=>true]:[])];
    }
}
