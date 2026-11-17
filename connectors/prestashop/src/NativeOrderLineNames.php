<?php
namespace TotusCentralConnector;

/** Own-order names only. Product, combination, quantity, tax and price stay native. */
final class NativeOrderLineNames
{
    public static function normalize($value): ?string
    {
        if($value===null)return null;
        Protocol::ensure(is_string($value)&&preg_match('//u',$value)===1,'LINE_NAME_INVALID');
        $name=trim($value,' ');
        Protocol::ensure(preg_match_all('/./us',$name)<=255&&!preg_match('/[\x00-\x1f\x7f<>={}]/u',$name),'LINE_NAME_INVALID');
        return $name===''?null:$name;
    }
    public static function names($value): array
    {
        Protocol::ensure(is_array($value)&&count($value)<=200,'LINE_NAMES_INVALID');$names=[];
        foreach($value as $key=>$name){
            Protocol::ensure(is_string($key)&&preg_match('/^([1-9][0-9]{0,9}):(0|[1-9][0-9]{0,9})$/D',$key,$ids)===1&&
                (int)$ids[1]<=2147483647&&(int)$ids[2]<=2147483647&&is_string($name)&&self::normalize($name)===$name&&$name!=='','LINE_NAMES_INVALID');
            $names[$key]=$name;
        }ksort($names);return $names;
    }
    public static function fromLines(array $lines): array
    {
        $names=[];foreach($lines as $line){if(!is_array($line)||!array_key_exists('display_name',$line))continue;
            Protocol::ensure(is_int($line['product_id']??null)&&$line['product_id']>0&&$line['product_id']<=2147483647&&
                is_int($line['attribute_id']??null)&&$line['attribute_id']>=0&&$line['attribute_id']<=2147483647,'LINE_NAMES_INVALID');
            $key=$line['product_id'].':'.$line['attribute_id'];Protocol::ensure(!isset($names[$key]),'LINE_NAMES_INVALID');$names[$key]=$line['display_name'];
        }return self::names($names);
    }
    private static function available(int $shop,bool $lock=false): bool
    {
        if($shop<1||!class_exists('OrderDetail')||!class_exists('Hook'))return false;
        $method=new \ReflectionMethod(\OrderDetail::class,'update');
        if($method->getDeclaringClass()->getName()!=='ObjectModelCore')return false;
        $db=\Db::getInstance()->getLink();if(!$db instanceof \PDO)return false;
        $ids=[];foreach(['actionObjectUpdateBefore','actionObjectUpdateAfter','actionObjectOrderDetailUpdateBefore','actionObjectOrderDetailUpdateAfter'] as $name){$id=(int)\Hook::getIdByName($name);if($id>0)$ids[]=$id;}
        $ids=array_values(array_unique($ids));if(!$ids)return true;
        $in=implode(',',array_fill(0,count($ids),'?'));
        $s=$db->prepare('SELECT m.name FROM `'._DB_PREFIX_.'hook_module` hm JOIN `'._DB_PREFIX_.'module` m ON m.id_module=hm.id_module JOIN `'._DB_PREFIX_.'module_shop` ms ON ms.id_module=m.id_module AND ms.id_shop=hm.id_shop WHERE hm.id_shop=? AND m.active=1 AND hm.id_hook IN('.$in.')'.($lock?' FOR UPDATE':''));
        $s->execute(array_merge([$shop],$ids));
        // Our reviewed catalogue-epoch hook ignores OrderDetail entirely.
        foreach($s->fetchAll(\PDO::FETCH_COLUMN) as $module)if($module!=='totuscentralconnector')return false;
        return true;
    }
    public static function supports(int $shop): bool
    {static $cache=[];return $cache[$shop]??=$shop>0&&self::available($shop);}
    public static function preflight(array $names,int $shop): void
    {if(self::names($names))Protocol::ensure(self::available($shop,true),'LINE_NAMES_NATIVE_HOOKS_UNREVIEWED');}
    public static function assertQuote(array $names,array $lines): void
    {Protocol::ensure(self::names($names)===self::fromLines($lines),'LINE_NAMES_QUOTE_MISMATCH');}
    public static function apply($order,array $names,array $lines): void
    {
        self::assertQuote($names,$lines);$names=self::names($names);$seen=[];
        foreach($order->getOrderDetailList() as $row){$key=(int)$row['product_id'].':'.(int)$row['product_attribute_id'];if(!isset($names[$key]))continue;
            Protocol::ensure(!isset($seen[$key]),'LINE_NAMES_AMBIGUOUS');$seen[$key]=true;
            $detail=new \OrderDetail((int)$row['id_order_detail']);
            Protocol::ensure(\Validate::isLoadedObject($detail)&&(int)$detail->id_order===(int)$order->id,'LINE_NAMES_ORDER_SCOPE_INVALID');
            $detail->setFieldsToUpdate(['product_name'=>true]);$detail->product_name=$names[$key];Protocol::ensure($detail->update(),'LINE_NAMES_NATIVE_UPDATE_FAILED');
        }
        Protocol::ensure(count($seen)===count($names),'LINE_NAMES_ORDER_SCOPE_INVALID');self::verify($order,$names);
    }
    public static function verify($order,array $names): void
    {
        $names=self::names($names);$seen=[];
        foreach($order->getOrderDetailList() as $row){$key=(int)$row['product_id'].':'.(int)$row['product_attribute_id'];if(!isset($names[$key]))continue;
            Protocol::ensure(!isset($seen[$key])&&(string)$row['product_name']===$names[$key],'LINE_NAMES_READBACK_FAILED');$seen[$key]=true;
        }Protocol::ensure(count($seen)===count($names),'LINE_NAMES_READBACK_FAILED');
    }
}
