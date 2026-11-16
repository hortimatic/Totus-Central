<?php
namespace TotusCentralConnector;

/** Optimise only the recognised native, unfiltered recent-orders grid.
 * No writes, index changes, global optimizer settings or core overrides.
 */
final class OrderGridPerformance
{
    public static string $lastStatus='not_requested';
    public static function apply($query,$criteria,string $prefix): bool
    {
        self::$lastStatus='unsupported_context';
        if(!$query instanceof \Doctrine\DBAL\Query\QueryBuilder || !$criteria instanceof \PrestaShop\PrestaShop\Core\Grid\Search\SearchCriteriaInterface
            || $criteria->getOrderBy()!=='id_order' || strtoupper((string)$criteria->getOrderWay())!=='DESC'
            || !preg_match('/^[a-zA-Z0-9_]+$/D',$prefix))return false;
        self::$lastStatus='filtered';
        foreach($criteria->getFilters() as $value)if(!self::emptyFilter($value))return false;
        self::$lastStatus='changed_grid';
        $from=$query->getQueryPart('from');
        if(count($from)!==1 || $from[0]['table']!==$prefix.'orders' || $from[0]['alias']!=='o'
            || $query->getQueryPart('orderBy')!==['o.id_order DESC'])return false;
        $connection=$query->getConnection();
        $sub=$connection->createQueryBuilder()->select('IF(count(so.id_order) > 0, 0, 1)')->from($prefix.'orders','so')
            ->where('so.id_customer = o.id_customer')->andWhere('so.id_order < o.id_order')->setMaxResults(1)->getSQL();
        $select=$query->getQueryPart('select');$index=array_search('('.$sub.') AS new',$select,true);
        if(!$select || str_starts_with($select[0],'STRAIGHT_JOIN '))return false;
        $exists=$connection->createQueryBuilder()->select('1')->from($prefix.'orders','so')
            ->where('so.id_customer = o.id_customer')->andWhere('so.id_order < o.id_order')->getSQL();
        // Other modules may remove the optional new-customer column. Preserve
        // their projection; only replace the exact native expression if present.
        if($index!==false)$select[$index]='IF(EXISTS('.$exists.'), 0, 1) AS new';
        $select[0]='STRAIGHT_JOIN '.$select[0];
        $query->select($select);
        self::$lastStatus=$index===false?'recent_orders':'recent_orders_and_exists';
        return true;
    }
    private static function emptyFilter($value): bool
    {
        if($value===null||$value==='')return true;
        if(!is_array($value))return false;
        foreach($value as $part)if(!self::emptyFilter($part))return false;
        return true;
    }
}
