<?php
namespace TotusCentralConnector;

/** Minimal, bounded customer selection. Never returns login/security fields. */
final class NativeCustomers
{
    public static function inShop(\Customer $customer,int $shop): bool
    {
        if((int)$customer->id_shop===$shop)return true;
        $selected=new \Shop($shop);$group=new \ShopGroup((int)$selected->id_shop_group);
        return (bool)$group->share_customer&&(int)$customer->id_shop_group===(int)$group->id;
    }
    public static function read(array $query,array $profile): array
    {
        $search=$query['search']??'';$page=(string)($query['page']??'0');$id=(string)($query['customer_id']??'0');
        Protocol::ensure(is_string($search)&&mb_check_encoding($search,'UTF-8')&&mb_strlen($search)<=100&&
            !preg_match('/[\x00-\x1f]/',$search)&&preg_match('/^(0|[1-9][0-9]{0,3})$/D',$page)&&
            preg_match('/^(0|[1-9][0-9]{0,9})$/D',$id),'CUSTOMER_QUERY_INVALID');
        $shop=(int)$profile['shop_id'];$nativeShop=new \Shop($shop);$group=new \ShopGroup((int)$nativeShop->id_shop_group);
        $db=\Db::getInstance()->getLink();$values=[];
        $sql='SELECT c.id_customer AS id,c.firstname,c.lastname,c.email,c.company,c.is_guest,c.id_default_group
            FROM `'._DB_PREFIX_.'customer` c WHERE c.active=1 AND c.deleted=0 AND ';
        if($group->share_customer){$sql.='c.id_shop_group=?';$values[]=(int)$group->id;}else{$sql.='c.id_shop=?';$values[]=$shop;}
        if((int)$id>0){$sql.=' AND c.id_customer=?';$values[]=(int)$id;}
        if(trim($search)!==''){$needle='%'.strtr(trim($search),['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
            $sql.=" AND (CONCAT(c.firstname,' ',c.lastname) LIKE ? ESCAPE '!' OR c.email LIKE ? ESCAPE '!' OR c.company LIKE ? ESCAPE '!' OR c.id_customer=?)";
            array_push($values,$needle,$needle,$needle,ctype_digit(trim($search))?(int)trim($search):0);}
        $sql.=' ORDER BY c.lastname,c.firstname,c.id_customer LIMIT 21 OFFSET '.((int)$page*20);
        $s=$db->prepare($sql);$s->execute($values);$rows=$s->fetchAll(\PDO::FETCH_ASSOC);$more=count($rows)>20;$rows=array_slice($rows,0,20);
        foreach($rows as &$row){$row['id']=(int)$row['id'];$row['id_default_group']=(int)$row['id_default_group'];$row['is_guest']=(bool)$row['is_guest'];}unset($row);
        $addresses=[];
        if((int)$id>0){Protocol::ensure(count($rows)===1,'CUSTOMER_UNAVAILABLE');
            $s=$db->prepare('SELECT id_address AS id,alias,firstname,lastname,company,address1,address2,postcode,city,id_country,id_state,phone,phone_mobile,dni,vat_number
                FROM `'._DB_PREFIX_.'address` WHERE id_customer=? AND deleted=0 AND id_supplier=0 AND id_manufacturer=0 ORDER BY alias,id_address LIMIT 100');
            $s->execute([(int)$id]);$addresses=$s->fetchAll(\PDO::FETCH_ASSOC);
            foreach($addresses as &$a)foreach(['id','id_country','id_state'] as $field)$a[$field]=(int)$a[$field];unset($a);
        }
        return ['items'=>$rows,'addresses'=>$addresses,'page'=>(int)$page,'has_more'=>$more,'shop_id'=>$shop,
            'defaults'=>['guest_group_id'=>(int)\Configuration::get('PS_GUEST_GROUP'),'customer_group_id'=>(int)\Configuration::get('PS_CUSTOMER_GROUP'),
                'country_id'=>(int)\Configuration::get('PS_COUNTRY_DEFAULT'),'language_id'=>(int)$profile['language_id']]];
    }
}
