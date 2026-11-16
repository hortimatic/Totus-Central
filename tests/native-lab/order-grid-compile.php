<?php
// Uses native PS/Doctrine classes; never connects to a database.
require __DIR__.'/../../artifacts/native-lab/shop/vendor/autoload.php';
require __DIR__.'/../../connectors/prestashop/src/OrderGridPerformance.php';
use PrestaShop\PrestaShop\Core\Grid\Query\OrderQueryBuilder;
use PrestaShop\PrestaShop\Core\Grid\Query\DoctrineSearchCriteriaApplicator;
use PrestaShop\PrestaShop\Core\Grid\Search\SearchCriteria;
use TotusCentralConnector\OrderGridPerformance;
$connection=Doctrine\DBAL\DriverManager::getConnection(['driver'=>'pdo_mysql','host'=>'127.0.0.1','port'=>1,'dbname'=>'not_connected','user'=>'none','platform'=>new Doctrine\DBAL\Platforms\MySqlPlatform()]);
$builder=new OrderQueryBuilder($connection,'fixture_',new DoctrineSearchCriteriaApplicator(),2,[1]);
$criteria=new SearchCriteria(['ajax_filter'=>'1','date_add'=>['from'=>'','to'=>'']],'id_order','desc',10,10);
$query=$builder->getSearchQueryBuilder($criteria);$params=$query->getParameters();
if(!OrderGridPerformance::apply($query,$criteria,'fixture_')||!str_starts_with($query->getSQL(),'SELECT STRAIGHT_JOIN ')
 ||!str_contains($query->getSQL(),'IF(EXISTS(')||$query->getParameters()!==$params||$query->getFirstResult()!==10||$query->getMaxResults()!==10)throw new RuntimeException('Native AJAX grid compile failed.');
foreach(['payment'=>'Efectivo','new'=>0,'ajax_filter'=>'other'] as $name=>$value){
 $criteria=new SearchCriteria(['ajax_filter'=>'1',$name=>$value],'id_order','desc',0,10);$query=$builder->getSearchQueryBuilder($criteria);$sql=$query->getSQL();
 if(OrderGridPerformance::apply($query,$criteria,'fixture_')||$query->getSQL()!==$sql)throw new RuntimeException('A real or unknown filter was changed.');
}
echo "PASS native Doctrine compilation: AJAX marker and empty dates accepted; real/unknown filters unchanged; no database connection.\n";
