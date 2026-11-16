<?php
require __DIR__.'/bootstrap.php';
require_once $project.'/connectors/prestashop/src/OrderGridPerformance.php';
use PrestaShop\PrestaShop\Core\Grid\Query\OrderQueryBuilder;
use PrestaShop\PrestaShop\Core\Grid\Query\DoctrineSearchCriteriaApplicator;
use PrestaShop\PrestaShop\Core\Grid\Search\SearchCriteria;
use TotusCentralConnector\OrderGridPerformance;
$settings=(require $nativeRoot.'/app/config/parameters.php')['parameters'];
$connection=Doctrine\DBAL\DriverManager::getConnection(['driver'=>'pdo_mysql','host'=>'127.0.0.1','port'=>3318,
 'dbname'=>'totus_tpv_lab','user'=>'tpv_lab','password'=>$settings['database_password'],'charset'=>'utf8mb4']);unset($settings);
$builder=new OrderQueryBuilder($connection,_DB_PREFIX_,new DoctrineSearchCriteriaApplicator(),1,[1]);
foreach([0,10,20] as $offset){
 $criteria=new SearchCriteria([],'id_order','DESC',$offset,10);$query=$builder->getSearchQueryBuilder($criteria);
 $original=$query->execute()->fetchAll();$params=$query->getParameters();$count=$builder->getCountQueryBuilder($criteria);$countSql=$count->getSQL();
 nativeLabCheck(OrderGridPerformance::apply($query,$criteria,_DB_PREFIX_),'Native grid not recognised.');
 nativeLabCheck($query->execute()->fetchAll()===$original,'Optimised grid changed rows, order, flags or pagination.');
 nativeLabCheck($query->getParameters()===$params&&$count->getSQL()===$countSql,'Parameters/count query changed.');
 nativeLabCheck(!OrderGridPerformance::apply($query,$criteria,_DB_PREFIX_),'Double optimisation must be a no-op.');
}
foreach([[['payment'=>'Efectivo'],'id_order','DESC'],[['new'=>0],'id_order','DESC'],[['date_add'=>['from'=>'2026-11-01','to'=>'']],'id_order','DESC'],[[],'date_add','DESC'],[[],'id_order','ASC']] as [$filters,$sort,$way]){
 $criteria=new SearchCriteria($filters,$sort,$way,0,10);$query=$builder->getSearchQueryBuilder($criteria);$sql=$query->getSQL();
 nativeLabCheck(!OrderGridPerformance::apply($query,$criteria,_DB_PREFIX_)&&$query->getSQL()===$sql,'Filtered or differently sorted query changed.');
}
$criteria=new SearchCriteria([],'id_order','DESC',0,10);$query=$builder->getSearchQueryBuilder($criteria);
$query->select(['o.id_order','o.reference']);$original=$query->execute()->fetchAll();
nativeLabCheck(OrderGridPerformance::apply($query,$criteria,_DB_PREFIX_)&&$query->execute()->fetchAll()===$original,'Custom projection changed.');
nativeLabCheck(OrderGridPerformance::$lastStatus==='recent_orders','Safe status does not identify projection-only optimisation.');
$criteria=new SearchCriteria(['date_add'=>['from'=>'','to'=>''],'payment'=>null],'id_order','DESC',0,10);
$query=$builder->getSearchQueryBuilder($criteria);$original=$query->execute()->fetchAll();
nativeLabCheck(OrderGridPerformance::apply($query,$criteria,_DB_PREFIX_)&&$query->execute()->fetchAll()===$original,'Empty native date fields must not count as active filters.');
echo "PASS native order grid: identical rows/new-customer flags/pagination, unchanged count and parameters, filtered/other sorting untouched; no commerce writes.\n";
