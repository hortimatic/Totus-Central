<?php
// Pure connector test: no bootstrap, credentials, database or writes.
namespace TotusCentralConnector {
    function time(): int {return $GLOBALS['testNow'];}
}
namespace {
    define('_DB_PREFIX_','fixture_');
    class Db {
        public static function getInstance(){return new self();}
        public function getLink(){return $this;}
        public function prepare($sql){return $this;}
        public function execute($parameters){}
        public function fetch($mode){return $GLOBALS['testDates'];}
    }
    require dirname(__DIR__,2).'/connectors/prestashop/src/Protocol.php';
    require dirname(__DIR__,2).'/connectors/prestashop/src/NativeCatalogue.php';
    $method=new ReflectionMethod(TotusCentralConnector\NativeCatalogue::class,'priceLifetime');
    $cases=[
        ['UTC','2026-11-18 12:00:15',null,null,86399000],
        ['UTC','2026-11-18 12:00:15','2026-11-18 12:02:00',null,104000],
        ['UTC','2026-11-18 12:00:15','2026-11-18 12:02:01',null,164000],
        ['UTC','2026-11-18 12:00:15',null,'2026-11-18 12:02:00',164000],
        ['UTC','2026-11-18 12:00:15',null,'2026-11-18 12:00:00',44000],
        ['UTC','2026-11-18 12:00:59',null,'2026-11-18 12:00:59',0],
        ['UTC','2026-11-18 23:59:15','2026-11-19 00:00:00',null,44000],
        ['UTC','2026-11-18 12:00:15','2026-11-18 12:02:00','2026-11-18 12:01:00',104000],
        ['Europe/Madrid','2026-03-29T01:59:15+01:00',null,null,44000],
        ['Europe/Madrid','2026-10-25T02:59:15+02:00',null,null,44000],
    ];
    foreach($cases as [$zone,$now,$starts,$ends,$expected]){
        date_default_timezone_set($zone);$GLOBALS['testNow']=strtotime($now);
        $GLOBALS['testDates']=['starts'=>$starts,'ends'=>$ends];
        $actual=$method->invoke(null,1,1,$GLOBALS['testNow']);
        if($actual!==$expected)throw new RuntimeException("Lifetime mismatch $zone $now: $actual != $expected");
    }
    echo 'PASS native price lifetime: future starts, inclusive ends, minute boundaries, midnight and both DST transitions. No database.'.PHP_EOL;
}
