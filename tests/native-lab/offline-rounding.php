<?php
// Original local shop rounding implementation; no bootstrap, credentials or writes.
foreach (['UP','DOWN','HALF_UP','HALF_DOWN','HALF_EVEN','HALF_ODD'] as $mode=>$name) define('PS_ROUND_'.$name,$mode);
require __DIR__.'/../../artifacts/native-lab/shop/classes/Tools.php';
class_alias('ToolsCore','Tools');
$rows=[];
if(in_array('--subtotals',$argv,true)){
    foreach([[[1005000,1],[1005000,1]],[[8012101,3],[1234567,2]],[[1,3],[9999,7]]] as $lines) foreach(range(0,5) as $mode) foreach([2,6] as $precision) foreach([1,2,3] as $type){
        $total=0;$display=0;
        foreach($lines as [$micros,$quantity]){
            $value=$micros/1000000;
            $line=$type===1?Tools::ps_round($value,$precision,$mode)*$quantity:($type===2?Tools::ps_round($value*$quantity,$precision,$mode):$value*$quantity);
            $total+=$line;$display+=(int)round(Tools::ps_round($line,2,$mode)*100);
        }
        $cents=(int)round(Tools::ps_round($total,2,$mode)*100);
        $rows[]=[$lines,$mode,$precision,$type,$cents,$cents-$display];
    }
    echo json_encode($rows);exit;
}
if(in_array('--lines',$argv,true)){
    foreach([1005000,8012101,1234567] as $micros) foreach(range(0,5) as $mode) foreach([2,6] as $precision) foreach([1,2] as $type){
        $quantity=3;$value=$micros/1000000;
        $line=$type===1?Tools::ps_round($value,$precision,$mode)*$quantity:Tools::ps_round($value*$quantity,$precision,$mode);
        $rows[]=[$micros,$quantity,$mode,$precision,$type,(int)round(Tools::ps_round($line,2,$mode)*100)];
    }
    echo json_encode($rows);exit;
}
foreach ([0,1,9999,10000,1000001,1004999,1005000,1005001,1015000,8012101,999999999] as $micros) {
    foreach (range(0,5) as $mode) $rows[]=[$micros,$mode,(int)round(Tools::ps_round($micros/1000000,2,$mode)*100)];
}
echo json_encode($rows);
