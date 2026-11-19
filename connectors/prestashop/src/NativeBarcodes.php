<?php
namespace TotusCentralConnector;

/** Missing fields only, one durably claimed native ObjectModel update at a time.
 * EAN-13 04 / UPC-A 4 are company-internal RCNs, not assigned global GTINs:
 * https://ref.gs1.org/standards/genspecs/24.0.0/ section 2.1.11.2.
 * A plan hash binds content and scope; it is NOT authentication. Central must
 * authorize Products/edit and persist the reviewed native plan before dispatch.
 */
final class NativeBarcodes
{
    private \PDO $db;private int $languageId;
    private const SCHEMES=['ean13'=>'rcn13-04','upc'=>'rcn12-4','reference'=>'totus-reference'];
    public function __construct(\PDO $db,int $languageId)
    {Protocol::ensure($languageId>0,'BARCODE_LANGUAGE_INVALID');$this->db=$db;$this->languageId=$languageId;}
    public static function checkDigit(string $body): string
    {Protocol::ensure(preg_match('/^\d{11,12}$/D',$body)===1,'BARCODE_BODY_INVALID');$sum=0;$weight=3;for($i=strlen($body)-1;$i>=0;$i--){$sum+=(int)$body[$i]*$weight;$weight=4-$weight;}return (string)((10-$sum%10)%10);}
    public static function codeKey(string $code): string
    {$value=function_exists('mb_strtoupper')?mb_strtoupper(trim($code),'UTF-8'):strtoupper(trim($code));return preg_match('/^\d{1,14}$/D',$value)?str_pad($value,14,'0',STR_PAD_LEFT):$value;}
    public static function candidate(string $field,int $productId,int $attributeId=0,int $attempt=0): string
    {
        Protocol::ensure(isset(self::SCHEMES[$field])&&$productId>0&&$productId<=2147483647&&$attributeId>=0&&$attributeId<=2147483647&&$attempt>=0&&$attempt<=2147483647,'BARCODE_CANDIDATE_INVALID');
        if($field==='reference')return 'TTPV-'.($attributeId?'V':'P').str_pad((string)($attributeId?:$productId),10,'0',STR_PAD_LEFT).($attempt?'-'.$attempt:'');
        $sequence=($attributeId?$attributeId*2+1:$productId*2)+$attempt*2;$body=($field==='ean13'?'04':'4').str_pad((string)$sequence,10,'0',STR_PAD_LEFT);return $body.self::checkDigit($body);
    }
    public static function matchesCandidate(string $field,int $productId,int $attributeId,string $code): bool
    {
        if(!isset(self::SCHEMES[$field])||$productId<1||$productId>2147483647||$attributeId<0||$attributeId>2147483647)return false;
        if($field==='reference'){
            $base=self::candidate($field,$productId,$attributeId);if($code===$base)return true;
            if(!str_starts_with($code,$base.'-'))return false;$suffix=substr($code,strlen($base)+1);
            return preg_match('/^[1-9][0-9]{0,9}$/D',$suffix)===1&&(int)$suffix<=2147483647&&self::candidate($field,$productId,$attributeId,(int)$suffix)===$code;
        }
        $prefix=$field==='ean13'?'04':'4';
        if(strlen($code)!==strlen($prefix)+11||!str_starts_with($code,$prefix)||!ctype_digit($code))return false;
        $sequence=(int)substr($code,strlen($prefix),10);$difference=$sequence-($attributeId?$attributeId*2+1:$productId*2);
        return $difference>=0&&$difference%2===0&&intdiv($difference,2)<=2147483647&&self::candidate($field,$productId,$attributeId,intdiv($difference,2))===$code;
    }
    private static function scope(array $scope): array
    {
        Protocol::ensure(Protocol::uuid($scope['installation_id']??null)&&Protocol::uuid($scope['actor_id']??null)&&is_int($scope['shop_id']??null)&&$scope['shop_id']>0&&is_int($scope['api_account_id']??null)&&$scope['api_account_id']>0,'BARCODE_SCOPE_INVALID');
        return array_intersect_key($scope,array_flip(['installation_id','actor_id','shop_id','api_account_id']));
    }
    private function codes(bool $lock=false): array
    {
        $pool=[];foreach(['product'=>'id_product','product_attribute'=>'id_product_attribute'] as $table=>$key){
            $s=$this->db->query('SELECT '.$key.',ean13,upc,reference FROM `'._DB_PREFIX_.$table.'` ORDER BY '.$key.($lock?' FOR UPDATE':''));
            while($row=$s->fetch(\PDO::FETCH_ASSOC))foreach(['ean13','upc','reference'] as $field)if((string)$row[$field]!=='')$pool[self::codeKey((string)$row[$field])][]=$table.':'.$row[$key].':'.$field;
        }return $pool;
    }
    private function identities(int $shop,string $field,int $limit,array $cursor=[0,0],?array $bounds=null): array
    {
        $bounds=$bounds??$this->bounds();$sql='SELECT * FROM (SELECT p.id_product product_id,0 attribute_id FROM `'._DB_PREFIX_.'product` p JOIN `'._DB_PREFIX_.'product_shop` ps ON ps.id_product=p.id_product AND ps.id_shop=? WHERE COALESCE(p.`'.$field.'`,\'\')=\'\' AND NOT EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'product_attribute` a WHERE a.id_product=p.id_product) AND (SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_shop` s WHERE s.id_product=p.id_product)=1 UNION ALL SELECT a.id_product product_id,a.id_product_attribute attribute_id FROM `'._DB_PREFIX_.'product_attribute` a JOIN `'._DB_PREFIX_.'product_attribute_shop` sa ON sa.id_product_attribute=a.id_product_attribute AND sa.id_shop=? JOIN `'._DB_PREFIX_.'product_shop` ps ON ps.id_product=a.id_product AND ps.id_shop=sa.id_shop WHERE COALESCE(a.`'.$field.'`,\'\')=\'\' AND (SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_attribute_shop` s WHERE s.id_product_attribute=a.id_product_attribute)=1) targets WHERE product_id<=? AND attribute_id<=? AND (product_id>? OR product_id=? AND attribute_id>?) ORDER BY product_id,attribute_id LIMIT '.($limit+1);
        $statement=$this->db->prepare($sql);$statement->execute([$shop,$shop,$bounds['product'],$bounds['attribute'],$cursor[0],$cursor[0],$cursor[1]]);return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }
    private function bounds(): array
    {
        return ['product'=>(int)$this->db->query('SELECT COALESCE(MAX(id_product),0) FROM `'._DB_PREFIX_.'product`')->fetchColumn(),'attribute'=>(int)$this->db->query('SELECT COALESCE(MAX(id_product_attribute),0) FROM `'._DB_PREFIX_.'product_attribute`')->fetchColumn()];
    }
    public function targets(array $scope,string $field,array $cursor=[0,0],?array $bounds=null): array
    {
        $scope=self::scope($scope);Protocol::ensure(isset(self::SCHEMES[$field])&&!$this->db->inTransaction()&&array_is_list($cursor)&&count($cursor)===2,'BARCODE_QUERY_INVALID');
        foreach($cursor as $id)Protocol::ensure(is_int($id)&&$id>=0&&$id<=2147483647,'BARCODE_QUERY_INVALID');
        $bounds=$bounds??$this->bounds();Protocol::ensure(count($bounds)===2&&array_diff(array_keys($bounds),['product','attribute'])===[],'BARCODE_QUERY_INVALID');
        foreach($bounds as $id)Protocol::ensure(is_int($id)&&$id>=0&&$id<=2147483647,'BARCODE_QUERY_INVALID');
        $ids=$this->identities($scope['shop_id'],$field,50,$cursor,$bounds);$more=count($ids)>50;$ids=array_slice($ids,0,50);$items=[];$next=$cursor;
        foreach($ids as $id){$id=['product_id'=>(int)$id['product_id'],'attribute_id'=>(int)$id['attribute_id']];$next=[$id['product_id'],$id['attribute_id']];$target=$this->target($id,$scope['shop_id'],$field);
            if($target['value']==='')$items[]=$id+['name'=>$target['name'],'variant_name'=>$target['variant_name'],'reference'=>$target['reference']];
        }
        return ['source'=>'native-missing-barcode-targets','plan_version'=>1,'field'=>$field,'shop_id'=>$scope['shop_id'],'items'=>$items,'has_more'=>$more,'cursor'=>$next,'bounds'=>$bounds];
    }
    private function collisionCount(string $code): int
    {
        $forms=[$code];if(preg_match('/^\d{1,14}$/D',$code)){$number=ltrim($code,'0');$number=$number===''?'0':$number;foreach([12,13,14] as $size)if(strlen($number)<=$size)$forms[]=str_pad($number,$size,'0',STR_PAD_LEFT);$forms[]=$number;}$forms=array_values(array_unique($forms));
        $in=implode(',',array_fill(0,count($forms),'?'));$expression='COALESCE(ean13 IN('.$in.'),0)+COALESCE(upc IN('.$in.'),0)+COALESCE(reference IN('.$in.'),0)';$count=0;
        foreach(['product','product_attribute'] as $table){$s=$this->db->prepare('SELECT COALESCE(SUM('.$expression.'),0) FROM `'._DB_PREFIX_.$table.'`');$s->execute(array_merge($forms,$forms,$forms));$count+=(int)$s->fetchColumn();}return $count;
    }
    private function sharedCount(int $shop,string $field): int
    {
        $sql='SELECT (SELECT COUNT(*) FROM `'._DB_PREFIX_.'product` p JOIN `'._DB_PREFIX_.'product_shop` ps ON ps.id_product=p.id_product AND ps.id_shop=? WHERE COALESCE(p.`'.$field.'`,\'\')=\'\' AND NOT EXISTS(SELECT 1 FROM `'._DB_PREFIX_.'product_attribute` a WHERE a.id_product=p.id_product) AND (SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_shop` s WHERE s.id_product=p.id_product)>1)+(SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_attribute` a JOIN `'._DB_PREFIX_.'product_attribute_shop` sa ON sa.id_product_attribute=a.id_product_attribute AND sa.id_shop=? WHERE COALESCE(a.`'.$field.'`,\'\')=\'\' AND (SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_attribute_shop` s WHERE s.id_product_attribute=a.id_product_attribute)>1)';
        $s=$this->db->prepare($sql);$s->execute([$shop,$shop]);return (int)$s->fetchColumn();
    }
    private function target(array $id,int $shop,string $field,bool $lock=false,bool $allowShared=false): array
    {
        Protocol::ensure(count($id)===2&&array_diff(array_keys($id),['product_id','attribute_id'])===[]&&is_int($id['product_id']??null)&&$id['product_id']>0&&$id['product_id']<=2147483647&&is_int($id['attribute_id']??null)&&$id['attribute_id']>=0&&$id['attribute_id']<=2147483647,'BARCODE_TARGET_INVALID');
        $s=$this->db->prepare('SELECT * FROM `'._DB_PREFIX_.'product` WHERE id_product=?'.($lock?' FOR UPDATE':''));$s->execute([$id['product_id']]);$product=$s->fetch(\PDO::FETCH_ASSOC);Protocol::ensure((bool)$product,'BARCODE_PRODUCT_UNAVAILABLE');
        $s=$this->db->prepare('SELECT id_shop FROM `'._DB_PREFIX_.'product_shop` WHERE id_product=? ORDER BY id_shop'.($lock?' FOR UPDATE':''));$s->execute([$id['product_id']]);$shops=array_map('intval',$s->fetchAll(\PDO::FETCH_COLUMN));Protocol::ensure(in_array($shop,$shops,true),'BARCODE_SCOPE_MISMATCH');
        $row=$product;$table='product';$primary='id_product';$variant='';
        if($id['attribute_id']===0){Protocol::ensure($allowShared||$shops===[$shop],'BARCODE_SHARED_PRODUCT_UNSUPPORTED');$s=$this->db->prepare('SELECT COUNT(*) FROM `'._DB_PREFIX_.'product_attribute` WHERE id_product=?');$s->execute([$id['product_id']]);Protocol::ensure((int)$s->fetchColumn()===0,'BARCODE_VARIANT_REQUIRED');}
        else{
            $s=$this->db->prepare('SELECT * FROM `'._DB_PREFIX_.'product_attribute` WHERE id_product_attribute=?'.($lock?' FOR UPDATE':''));$s->execute([$id['attribute_id']]);$row=$s->fetch(\PDO::FETCH_ASSOC);Protocol::ensure($row&&(int)$row['id_product']===$id['product_id'],'BARCODE_VARIANT_MISMATCH');
            $s=$this->db->prepare('SELECT id_shop FROM `'._DB_PREFIX_.'product_attribute_shop` WHERE id_product_attribute=? ORDER BY id_shop'.($lock?' FOR UPDATE':''));$s->execute([$id['attribute_id']]);$attributeShops=array_map('intval',$s->fetchAll(\PDO::FETCH_COLUMN));Protocol::ensure($allowShared?in_array($shop,$attributeShops,true):$attributeShops===[$shop],'BARCODE_SHARED_PRODUCT_UNSUPPORTED');
            $table='product_attribute';$primary='id_product_attribute';$s=$this->db->prepare('SELECT al.name FROM `'._DB_PREFIX_.'product_attribute_combination` pac JOIN `'._DB_PREFIX_.'attribute_lang` al ON al.id_attribute=pac.id_attribute AND al.id_lang=? WHERE pac.id_product_attribute=? ORDER BY pac.id_attribute');$s->execute([$this->languageId,$id['attribute_id']]);$variant=implode(' · ',$s->fetchAll(\PDO::FETCH_COLUMN));
        }
        $s=$this->db->prepare('SELECT name FROM `'._DB_PREFIX_.'product_lang` WHERE id_product=? AND id_shop=? AND id_lang=?');$s->execute([$id['product_id'],$shop,$this->languageId]);$name=$s->fetchColumn();
        return ['id'=>$id,'row'=>$row,'product'=>$product,'table'=>$table,'primary'=>$primary,'name'=>mb_substr($name===false?'Artículo #'.$id['product_id']:(string)$name,0,255),'variant_name'=>mb_substr($variant,0,255),'reference'=>(string)$row['reference'],'value'=>(string)($row[$field]??'')];
    }
    /** Existing native TCPDF encoder; expose only bounded binary modules, never
     * vendor HTML/SVG or stale generation receipts, to the browser. */
    public static function labelPattern(string $field,string $code): ?array
    {
        if(!isset(self::SCHEMES[$field])||$code===''||strlen($code)>64)return null;
        if($field==='reference'){if(preg_match('/^[\x20-\x7e]{1,64}$/D',$code)!==1)return null;$type='C128';}
        else{if(preg_match($field==='ean13'?'/^\d{13}$/D':'/^\d{12}$/D',$code)!==1||self::checkDigit(substr($code,0,-1))!==substr($code,-1))return null;$type=$field==='ean13'?'EAN13':'UPCA';}
        if(!class_exists('TCPDFBarcode'))require_once _PS_ROOT_DIR_.'/vendor/tecnickcom/tcpdf/tcpdf_barcodes_1d.php';
        $encoded=(new \TCPDFBarcode($code,$type))->getBarcodeArray();
        if(!is_array($encoded)||!isset($encoded['bcode'])||!is_array($encoded['bcode']))return null;
        $bits='';foreach($encoded['bcode'] as $bar){
            // TCPDF Code128 uses whole-valued floats and zero-width stop padding.
            // Preserve its geometry; accept only finite, integral module widths.
            if(!isset($bar['w'],$bar['t'])||!is_bool($bar['t'])||!(is_int($bar['w'])||is_float($bar['w'])&&is_finite($bar['w'])&&floor($bar['w'])===$bar['w']||is_string($bar['w'])&&preg_match('/^(0|[1-9][0-9]?)$/D',$bar['w'])===1))return null;
            $width=(int)$bar['w'];if($width<0||$width>64)return null;if($width===0)continue;$bits.=str_repeat($bar['t']?'1':'0',$width);if(strlen($bits)>4096)return null;
        }
        return $bits===''?null:['symbology'=>$field==='reference'?'code128':($field==='ean13'?'ean13':'upca'),'modules'=>$bits];
    }
    public function labels(array $scope,string $field,array $selection): array
    {
        $scope=self::scope($scope);Protocol::ensure(isset(self::SCHEMES[$field])&&array_is_list($selection)&&count($selection)>=1&&count($selection)<=50,'BARCODE_QUERY_INVALID');
        $items=[];$skipped=[];$seen=[];foreach($selection as $id){
            $target=$this->target($id,$scope['shop_id'],$field,false,true);$identity=$id['product_id'].':'.$id['attribute_id'];Protocol::ensure(!isset($seen[$identity]),'BARCODE_TARGET_DUPLICATE');$seen[$identity]=true;
            $pattern=self::labelPattern($field,$target['value']);
            if($pattern===null){$skipped[]=$id+['reason'=>$target['value']===''?'missing-code':'invalid-code'];continue;}
            $items[]=$id+['name'=>$target['name'],'variant_name'=>$target['variant_name'],'reference'=>$target['reference'],'code'=>$target['value']]+$pattern;
        }
        return ['source'=>'native-barcode-labels','field'=>$field,'shop_id'=>$scope['shop_id'],'items'=>$items,'skipped'=>$skipped];
    }
    private function build(array $scope,string $field,array $ids,array $pool,bool $lock=false): array
    {
        $items=[];$seen=[];foreach($ids as $id){$target=$this->target($id,$scope['shop_id'],$field,$lock);$key=$id['product_id'].':'.$id['attribute_id'];Protocol::ensure(!isset($seen[$key]),'BARCODE_TARGET_DUPLICATE');$seen[$key]=true;Protocol::ensure($target['value']==='','BARCODE_FIELD_ALREADY_SET');
            // Each occupied alias can exclude at most one candidate. Search a
            // catalogue-derived bound instead of failing after an arbitrary
            // thousand collisions (EAN/UPC aliases share the numeric space).
            $code=null;$attemptLimit=min(2147483647,count($pool));for($attempt=0;$attempt<=$attemptLimit;$attempt++){$candidate=self::candidate($field,$id['product_id'],$id['attribute_id'],$attempt);if(!isset($pool[self::codeKey($candidate)])&&$this->collisionCount($candidate)===0){$code=$candidate;$pool[self::codeKey($candidate)]=['reserved'];break;}}
            Protocol::ensure($code!==null,'BARCODE_ALLOCATION_LIMIT');$items[]=['product_id'=>$id['product_id'],'attribute_id'=>$id['attribute_id'],'name'=>$target['name'],'variant_name'=>$target['variant_name'],'reference'=>$target['reference'],'code'=>$code,'snapshot_fingerprint'=>$this->snapshot($id,$field)];
        }return $items;
    }
    private static function planHash(array $scope,string $field,array $items): string{return hash('sha256',Protocol::canonical(['plan_version'=>1,'scope'=>self::scope($scope),'field'=>$field,'items'=>$items]));}
    private function nativeHooksReviewed(int $shop,array $items,bool $lock=false): bool
    {
        if(!$items)return true;
        // Product::update invokes product-save hooks: e.g. ps_facetedsearch
        // TRUNCATEs a cache table and implicitly commits MySQL transactions.
        // Keep native behavior intact. Unknown hook providers require review;
        // reject before any business write instead of bypassing native hooks.
        $hooks=['actionObjectUpdateBefore','actionObjectUpdateAfter'];
        foreach($items as $item){$type=$item['attribute_id']?'Combination':'Product';$hooks[]='actionObject'.$type.'UpdateBefore';$hooks[]='actionObject'.$type.'UpdateAfter';if($type==='Product'){$hooks[]='actionProductSave';$hooks[]='actionProductUpdate';}}
        $hooks=array_values(array_unique($hooks));$in=implode(',',array_fill(0,count($hooks),'?'));
        $s=$this->db->prepare('SELECT m.name,m.version,h.name hook_name FROM `'._DB_PREFIX_.'hook_module` hm JOIN `'._DB_PREFIX_.'hook` h ON h.id_hook=hm.id_hook JOIN `'._DB_PREFIX_.'module` m ON m.id_module=hm.id_module JOIN `'._DB_PREFIX_.'module_shop` ms ON ms.id_module=m.id_module AND ms.id_shop=hm.id_shop WHERE hm.id_shop=? AND m.active=1 AND h.name IN('.$in.') ORDER BY hm.id_module,hm.id_hook'.($lock?' FOR UPDATE':''));$s->execute(array_merge([$shop],$hooks));
        $cacheModules=['ps_featuredproducts'=>'2.1.6','ps_specials'=>'1.0.3','ps_newproducts'=>'1.0.5','ps_bestsellers'=>'1.0.7'];
        foreach($s->fetchAll(\PDO::FETCH_ASSOC) as $module){if($module['name']==='totuscentralconnector')continue;
            if(($cacheModules[$module['name']]??null)===$module['version']&&$module['hook_name']==='actionProductUpdate')continue;
            if($module['name']==='ps_mainmenu'&&$module['version']==='2.3.4'&&$module['hook_name']==='actionObjectProductUpdateAfter')continue;
            // Reviewed installed 4.0.4 provider invalidates caches AFTER native SQL.
            // Its TRUNCATE may commit; the per-target coordinator handles that.
            if($module['name']==='ps_facetedsearch'&&$module['version']==='4.0.4'&&in_array($module['hook_name'],['actionProductSave','actionProductUpdate'],true))continue;return false;}return true;
    }
    public function plan(array $scope,string $field,int $limit=50,?array $selection=null,bool $skipExisting=false): array
    {
        $scope=self::scope($scope);Protocol::ensure(isset(self::SCHEMES[$field])&&$limit>=1&&$limit<=50&&!$this->db->inTransaction()&&(!$skipExisting||$selection!==null),'BARCODE_PLAN_INVALID');
        $ids=$selection??$this->identities($scope['shop_id'],$field,$limit);Protocol::ensure(array_is_list($ids)&&count($ids)<=($selection===null?$limit+1:50),'BARCODE_TARGET_INVALID');
        if($selection!==null)foreach($ids as $id)Protocol::ensure(is_array($id)&&count($id)===2&&array_diff(array_keys($id),['product_id','attribute_id'])===[]&&is_int($id['product_id']??null)&&is_int($id['attribute_id']??null),'BARCODE_TARGET_INVALID');
        $more=count($ids)>$limit;$ids=array_slice($ids,0,$limit);$ids=array_map(static fn($id)=>['product_id'=>(int)$id['product_id'],'attribute_id'=>(int)$id['attribute_id']],$ids);
        usort($ids,static fn($a,$b)=>[$a['product_id'],$a['attribute_id']]<=>[$b['product_id'],$b['attribute_id']]);
        Protocol::ensure(count(array_unique(array_map(static fn($id)=>$id['product_id'].':'.$id['attribute_id'],$ids)))===count($ids),'BARCODE_TARGET_DUPLICATE');
        $skipped=[];
        if($skipExisting){$missing=[];foreach($ids as $id){
            try{$target=$this->target($id,$scope['shop_id'],$field);}
            catch(\InvalidArgumentException $error){if(!in_array($error->getMessage(),['TOTUS_BARCODE_PRODUCT_UNAVAILABLE','TOTUS_BARCODE_SCOPE_MISMATCH','TOTUS_BARCODE_VARIANT_MISMATCH','TOTUS_BARCODE_SHARED_PRODUCT_UNSUPPORTED'],true))throw $error;$skipped[]=$id+['reason'=>'unavailable','code'=>null];continue;}
            if($target['value']!=='')$skipped[]=$id+['reason'=>'already-set','code'=>$target['value']];else $missing[]=$id;
        }$ids=$missing;}
        $items=$this->build($scope,$field,$ids,$this->codes());$ready=$this->nativeHooksReviewed($scope['shop_id'],$items);
        return ['source'=>'native-missing-barcodes-plan','plan_version'=>1,'capability'=>['can_execute'=>$ready,'reason'=>$ready?'ready':'native_hooks_need_review'],'field'=>$field,'scheme'=>self::SCHEMES[$field],'shop_id'=>$scope['shop_id'],'items'=>$items,'skipped_targets'=>$skipped,'has_more'=>$more,'skipped_shared'=>$this->sharedCount($scope['shop_id'],$field),'plan_fingerprint'=>self::planHash($scope,$field,$items)];
    }
    // Bind identity and shop storage, not mutable prices or stock. Legitimate
    // sales and catalogue edits must not invalidate a missing-code intention.
    private function snapshot(array $id,string $field): string
    {
        $statement=$this->db->prepare('SELECT id_shop FROM `'._DB_PREFIX_.'product_shop` WHERE id_product=? ORDER BY id_shop');$statement->execute([$id['product_id']]);$shops=array_map('intval',$statement->fetchAll(\PDO::FETCH_COLUMN));
        $attributeShops=[];$parent=0;
        if($id['attribute_id']>0){
            $statement=$this->db->prepare('SELECT id_product FROM `'._DB_PREFIX_.'product_attribute` WHERE id_product_attribute=?');$statement->execute([$id['attribute_id']]);$parent=(int)$statement->fetchColumn();
            $statement=$this->db->prepare('SELECT id_shop FROM `'._DB_PREFIX_.'product_attribute_shop` WHERE id_product_attribute=? ORDER BY id_shop');$statement->execute([$id['attribute_id']]);$attributeShops=array_map('intval',$statement->fetchAll(\PDO::FETCH_COLUMN));
        }
        return hash('sha256',Protocol::canonical(['id'=>$id,'field'=>$field,'shops'=>$shops,'attribute_parent'=>$parent,'attribute_shops'=>$attributeShops]));
    }
    private function selected(array $command): array
    {
        $scope=self::scope($command);$p=$command['payload']??[];
        Protocol::ensure(($command['command']??null)==='barcodes.assign'&&Protocol::uuid($command['operation_id']??null)&&is_array($p)&&count($p)===5&&array_diff(array_keys($p),['plan_version','field','items','plan_fingerprint','item_index'])===[]&&($p['plan_version']??null)===1&&is_string($p['field']??null)&&isset(self::SCHEMES[$p['field']])&&is_array($p['items']??null)&&array_is_list($p['items'])&&count($p['items'])>=1&&count($p['items'])<=50&&is_int($p['item_index']??null)&&isset($p['items'][$p['item_index']])&&is_string($p['plan_fingerprint']??null)&&hash_equals(self::planHash($scope,$p['field'],$p['items']),$p['plan_fingerprint']),'BARCODE_REQUEST_INVALID');
        $identities=[];$codes=[];
        foreach($p['items'] as $item){
            Protocol::ensure(is_array($item)&&count($item)===7&&array_diff(array_keys($item),['product_id','attribute_id','name','variant_name','reference','code','snapshot_fingerprint'])===[]&&is_int($item['product_id']??null)&&$item['product_id']>0&&$item['product_id']<=2147483647&&is_int($item['attribute_id']??null)&&$item['attribute_id']>=0&&$item['attribute_id']<=2147483647&&is_string($item['code']??null)&&is_string($item['snapshot_fingerprint']??null)&&preg_match('/^[a-f0-9]{64}$/D',$item['snapshot_fingerprint'])===1,'BARCODE_TARGET_INVALID');
            foreach(['name'=>255,'variant_name'=>255,'reference'=>64] as $key=>$max)Protocol::ensure(is_string($item[$key]??null)&&mb_strlen($item[$key])<=$max,'BARCODE_TARGET_INVALID');
            $valid=self::matchesCandidate($p['field'],$item['product_id'],$item['attribute_id'],$item['code']);
            $id=$item['product_id'].':'.$item['attribute_id'];$code=self::codeKey($item['code']);Protocol::ensure($valid&&!isset($identities[$id])&&!isset($codes[$code]),'BARCODE_TARGET_INVALID');$identities[$id]=true;$codes[$code]=true;
        }
        return [$scope,$p,$p['items'][$p['item_index']]];
    }
    private function result(array $command,array $p,array $item): array
    {
        return ['verified'=>true,'native_reference'=>$command['operation_id'],'shop_id'=>$command['shop_id'],'plan_version'=>1,'field'=>$p['field'],'scheme'=>self::SCHEMES[$p['field']],'plan_fingerprint'=>$p['plan_fingerprint'],'item_index'=>$p['item_index'],'items'=>[$item],'count'=>1];
    }
    public function validateCommand(array $command): void{$this->selected($command);}
    public function validateResult(array $receipt,array $command): array
    {
        [$scope,$p,$item]=$this->selected($command);
        Protocol::ensure(Protocol::canonical($receipt)===Protocol::canonical($this->result($command,$p,$item)),'BARCODE_READBACK_FAILED');
        return $receipt;
    }
    /** Called once after an independent durable journal claim and row locks. */
    public function execute(array $command): array
    {
        [$scope,$p,$item]=$this->selected($command);
        Protocol::ensure($this->db->inTransaction()&&$this->db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql'&&\Db::getInstance()->getLink()===$this->db,'BARCODE_NATIVE_TRANSACTION_REQUIRED');
        $this->codes(true);$id=['product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id']];$target=$this->target($id,$scope['shop_id'],$p['field'],true);
        Protocol::ensure($target['value']==='','BARCODE_FIELD_ALREADY_SET');
        Protocol::ensure(hash_equals($item['snapshot_fingerprint'],$this->snapshot($id,$p['field']))&&$this->collisionCount($item['code'])===0,'BARCODE_PLAN_CHANGED');
        Protocol::ensure($this->nativeHooksReviewed($scope['shop_id'],[$item],true),'BARCODE_NATIVE_HOOK_REVIEW_REQUIRED');
        Protocol::ensure(!(bool)($target['product']['advanced_stock_management']??false),'BARCODE_ADVANCED_STOCK_UNSUPPORTED');
        $context=\Context::getContext();$previous=$context->shop;$previousType=\Shop::getContext();$previousShop=\Shop::getContextShopID();$context->shop=new \Shop($scope['shop_id']);\Shop::setContext(\Shop::CONTEXT_SHOP,$scope['shop_id']);
        try{
            \Cache::clean('*');$entity=$item['attribute_id']?new \Combination($item['attribute_id'],null,$scope['shop_id']):new \Product($item['product_id'],false,null,$scope['shop_id']);
            Protocol::ensure(\Validate::isLoadedObject($entity),'BARCODE_PRODUCT_UNAVAILABLE');$entity->{$p['field']}=$item['code'];$entity->setFieldsToUpdate([$p['field']=>true]);Protocol::ensure($entity->update(),'BARCODE_NATIVE_UPDATE_FAILED');
            \Cache::clean('*');return $this->verify($this->result($command,$p,$item),$command);
        }finally{$context->shop=$previous;\Shop::setContext($previousType,$previousShop);}
    }
    public function preservedCode(array $command): ?array
    {
        [$scope,$p,$item]=$this->selected($command);
        $target=$this->target(['product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id']],$scope['shop_id'],$p['field']);
        if($target['value']===''||mb_strlen($target['value'])>64)return null;
        return ['plan_version'=>1,'shop_id'=>$scope['shop_id'],'field'=>$p['field'],'product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id'],'code'=>$target['value'],'plan_fingerprint'=>$p['plan_fingerprint'],'item_index'=>$p['item_index']];
    }
    public function verify(array $receipt,array $command): array
    {
        [$scope,$p,$item]=$this->selected($command);
        Protocol::ensure(Protocol::canonical($receipt)===Protocol::canonical($this->result($command,$p,$item)),'BARCODE_READBACK_FAILED');
        $target=$this->target(['product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id']],$scope['shop_id'],$p['field']);
        $owner=$target['table'].':'.($item['attribute_id']?:$item['product_id']).':'.$p['field'];$pool=$this->codes();
        Protocol::ensure($target['value']===$item['code']&&($pool[self::codeKey($item['code'])]??[])===[$owner]&&$this->collisionCount($item['code'])===1&&hash_equals($item['snapshot_fingerprint'],$this->snapshot(['product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id']],$p['field'])),'BARCODE_READBACK_FAILED');
        return $receipt;
    }
    /** Observe the bound target only. A missing result NEVER authorizes replay. */
    public function reconcile(array $command,array $claim): ?array
    {
        [$scope,$p,$item]=$this->selected($command);
        $target=$this->target(['product_id'=>$item['product_id'],'attribute_id'=>$item['attribute_id']],$scope['shop_id'],$p['field']);
        if($target['value']!==$item['code'])return null;
        return $this->verify($this->result($command,$p,$item),$command);
    }
}
