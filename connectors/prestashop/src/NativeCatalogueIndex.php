<?php
namespace TotusCentralConnector;

/** Bounded construction of a complete native price order. No catalogue is
 * copied to Central. An incomplete index never pretends to be a sorted page. */
final class NativeCatalogueIndex
{
    private \PDO $db;
    private string $table;
    private bool $sqlite;
    public function __construct(\PDO $db,string $table)
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'CATALOGUE_INDEX_INVALID');
        $this->db=$db;$this->table=$table;$this->sqlite=$db->getAttribute(\PDO::ATTR_DRIVER_NAME)==='sqlite';
    }
    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'CATALOGUE_INDEX_INVALID');
        return 'CREATE TABLE `'.$table.'` (cache_key CHAR(64) NOT NULL PRIMARY KEY,payload MEDIUMTEXT NOT NULL,
            expires_at BIGINT UNSIGNED NOT NULL,updated_at BIGINT UNSIGNED NOT NULL,KEY expiry(expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    }
    public static function sqliteSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'CATALOGUE_INDEX_INVALID');
        return 'CREATE TABLE `'.$table.'` (cache_key TEXT PRIMARY KEY,payload TEXT NOT NULL,expires_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)';
    }
    /** The caller includes shop/customer/tax context and an invalidation epoch
     * in $context. $ids is the entire filtered result in stable native ID order.
     * $validUntil bounds scheduled price changes; previews are never payable. */
    public function page(array $context,array $ids,callable $price,int $offset,int $size,string $direction,int $validUntil,?int $now=null,int $batch=200): array
    {
        $now??=(int)floor(microtime(true)*1000);
        Protocol::ensure($offset>=0&&$size>0&&$size<=50&&in_array($direction,['asc','desc'],true)&&$batch>0&&$batch<=500&&
            count($ids)<=200000&&count(array_unique($ids))===count($ids)&&$validUntil>$now,'CATALOGUE_INDEX_INVALID');
        foreach($ids as $id)Protocol::ensure(is_string($id)&&preg_match('/^[1-9][0-9]*:[0-9]+$/D',$id)===1,'CATALOGUE_INDEX_INVALID');
        $key=hash('sha256',json_encode([$context,$ids],JSON_THROW_ON_ERROR));
        $initial=['ids'=>$ids,'prices'=>[],'cursor'=>0,'createdAt'=>$now,'ready'=>false];
        Protocol::ensure(!$this->db->inTransaction(),'CATALOGUE_INDEX_TRANSACTION_ACTIVE');
        $this->db->beginTransaction();
        try{
            $insert=$this->db->prepare(($this->sqlite?'INSERT OR IGNORE':'INSERT IGNORE').' INTO `'.$this->table.'` (cache_key,payload,expires_at,updated_at) VALUES (?,?,?,?)');
            $insert->execute([$key,json_encode($initial,JSON_THROW_ON_ERROR),min($validUntil,$now+300000),$now]);
            $get=$this->db->prepare('SELECT payload,expires_at FROM `'.$this->table.'` WHERE cache_key=?'.($this->sqlite?'':' FOR UPDATE'));
            $get->execute([$key]);$row=$get->fetch(\PDO::FETCH_ASSOC);
            Protocol::ensure(is_array($row),'CATALOGUE_INDEX_STORAGE_REQUIRED');
            $data=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);
            // A slow catalogue must stop with an explicit error rather than
            // repeatedly reset its progress and keep the operator waiting.
            Protocol::ensure(!is_array($data)||!empty($data['ready'])||
                ($data['createdAt']??0)+300000>$now,'CATALOGUE_INDEX_BUILD_EXPIRED');
            if((int)$row['expires_at']<=$now)$data=$initial;
            Protocol::ensure(is_array($data)&&$data['ids']===$ids&&is_array($data['prices'])&&is_int($data['cursor'])&&
                $data['cursor']>=0&&$data['cursor']<=count($ids),'CATALOGUE_INDEX_STORAGE_INVALID');
            $started=microtime(true);$processed=0;
            while(!$data['ready']&&$data['cursor']<count($ids)&&$processed<$batch&&microtime(true)-$started<0.75){
                $id=$ids[$data['cursor']];$cents=$price($id);
                Protocol::ensure(is_int($cents)&&$cents>=0&&$cents<=9007199254740991,'CATALOGUE_INDEX_PRICE_INVALID');
                $data['prices'][$id]=$cents;$data['cursor']++;$processed++;
            }
            if(!$data['ready']&&$data['cursor']===count($ids)){
                $ordered=$ids;
                usort($ordered,static function($left,$right)use($data){$amount=$data['prices'][$left]<=>$data['prices'][$right];
                    if($amount!==0)return $amount;[$lp,$la]=array_map('intval',explode(':',$left));[$rp,$ra]=array_map('intval',explode(':',$right));
                    return ($lp<=>$rp)?:($la<=>$ra);});
                $data['ordered']=$ordered;$data['ready']=true;
            }
            $expires=min($validUntil,$data['createdAt']+300000);
            $save=$this->db->prepare('UPDATE `'.$this->table.'` SET payload=?,expires_at=?,updated_at=? WHERE cache_key=?');
            $save->execute([json_encode($data,JSON_THROW_ON_ERROR),$expires,$now,$key]);
            $this->db->commit();
            if(!$data['ready'])return ['ready'=>false,'done'=>$data['cursor'],'total'=>count($ids),'snapshot_at'=>$data['createdAt']];
            $ordered=$direction==='desc'?array_reverse($data['ordered']):$data['ordered'];$page=array_slice($ordered,$offset,$size);
            return ['ready'=>true,'ids'=>$page,'prices'=>array_intersect_key($data['prices'],array_flip($page)),
                'total'=>count($ids),'has_more'=>$offset+$size<count($ids),'snapshot_at'=>$data['createdAt']];
        }catch(\Throwable $error){if($this->db->inTransaction())$this->db->rollBack();throw $error;}
    }
}
