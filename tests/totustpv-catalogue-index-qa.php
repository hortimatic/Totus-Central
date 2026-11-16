<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeCatalogueIndex.php';
use TotusCentralConnector\NativeCatalogueIndex;
$db=new PDO('sqlite::memory:');$db->setAttribute(PDO::ATTR_ERRMODE,PDO::ERRMODE_EXCEPTION);
$db->exec(NativeCatalogueIndex::sqliteSchema('price_index'));
$index=new NativeCatalogueIndex($db,'price_index');$calls=0;$now=100000;
$ids=['1:0','2:0','3:0','4:0','5:0'];$prices=['1:0'=>500,'2:0'=>100,'3:0'=>300,'4:0'=>100,'5:0'=>200];
$price=static function($id)use(&$calls,$prices){$calls++;return $prices[$id];};
$check=static function($ok,$message){if(!$ok)throw new RuntimeException($message);};
$first=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,0,2,'asc',$now+60000,$now,2);
$check(!$first['ready']&&$first['done']===2&&!isset($first['ids']),'An incomplete price order must not expose a partially sorted page');
$second=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,0,2,'asc',$now+60000,$now,2);
$check(!$second['ready']&&$second['done']===4,'Build must resume the next IDs');
$complete=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,0,2,'asc',$now+60000,$now,2);
$check($complete['ids']===['2:0','4:0']&&$complete['has_more'],'The first page must use the full native price order with stable ties');
$check($calls===5,'Native prices must be computed once per complete snapshot');
$page2=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,2,2,'asc',$now+60000,$now,2);
$check($page2['ids']===['5:0','3:0']&&$calls===5,'The second page must continue the whole-result order without recomputing');
$descending=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,0,2,'desc',$now+60000,$now,2);
$check($descending['ids']===['1:0','3:0'],'Descending must reverse the complete order');
$changed=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'b'],$ids,$price,0,2,'asc',$now+60000,$now,2);
$check(!$changed['ready']&&$calls===7,'A native catalogue change must start a fresh snapshot');
$otherCustomer=$index->page(['shop'=>1,'customer'=>2,'epoch'=>'a'],$ids,$price,0,2,'asc',$now+60000,$now,2);
$check(!$otherCustomer['ready'],'Customer contexts must not share prices');
$expired=$index->page(['shop'=>1,'customer'=>1,'epoch'=>'a'],$ids,$price,0,2,'asc',$now+120000,$now+60001,2);
$check(!$expired['ready']&&$expired['done']===2,'Scheduled expiry must rebuild the whole order');
$timeout=false;try{$index->page(['shop'=>1,'customer'=>1,'epoch'=>'b'],$ids,$price,0,2,'asc',$now+600000,$now+300001,2);}catch(Throwable $error){$timeout=$error->getMessage()==='TOTUS_CATALOGUE_INDEX_BUILD_EXPIRED';}
$check($timeout,'Slow builds must stop explicitly instead of restarting progress forever');
$failed=false;try{$index->page(['shop'=>2],$ids,static fn()=>-1,0,2,'asc',$now+60000,$now,2);}catch(Throwable $error){$failed=true;}
$check($failed&&!$db->inTransaction(),'An invalid native price must roll back the build');
echo "PASS bounded native price index: full-result pagination, stable price ties, resume, context/epoch isolation, expiry and rollback. SQLite storage; price reader synthetic.\n";
