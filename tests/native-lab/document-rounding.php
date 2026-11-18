<?php
// Original native Tools, no shop bootstrap or database.
foreach(['UP','DOWN','HALF_UP','HALF_DOWN','HALF_EVEN','HALF_ODD'] as $mode=>$name)define('PS_ROUND_'.$name,$mode);
require __DIR__.'/../../artifacts/native-lab/shop/classes/Tools.php';class_alias('ToolsCore','Tools');
require __DIR__.'/../../connectors/prestashop/src/NativeDocuments.php';
use TotusCentralConnector\NativeDocuments;
$expected=[[101,100,101,100,100,101],[102,101,102,101,102,101]];
foreach(['1.005000','1.015000'] as $i=>$amount)foreach(range(0,5) as $mode){
 if(NativeDocuments::amountCents($amount,$mode)!==$expected[$i][$mode])throw new RuntimeException('Historical rounding mode lost.');
 if(NativeDocuments::amountCents('8.010000',$mode)!==801)throw new RuntimeException('Exact amount changed.');
}
foreach(['-1','not-a-number',INF,1000000001] as $bad){$rejected=false;try{NativeDocuments::amountCents($bad,2);}catch(InvalidArgumentException $e){$rejected=true;}if(!$rejected)throw new RuntimeException('Invalid amount accepted.');}
echo 'PASS native documents preserve all six historical rounding modes and exact cents. No database.'.PHP_EOL;

$details=[['product_id'=>1,'product_attribute_id'=>0,'total_price_tax_excl'=>'1.005000','total_price_tax_incl'=>'1.005000'],['product_id'=>2,'product_attribute_id'=>0,'total_price_tax_excl'=>'1.005000','total_price_tax_incl'=>'1.216050']];
$balanced=NativeDocuments::reconcileTicketTotals($details,222,201,2);
if(array_sum(array_column($balanced,'line_cents'))!==222||array_sum(array_column($balanced,'tax_excl_cents'))!==201||$balanced[0]['tax_cents']!==0)throw new RuntimeException('Mixed-tax ticket failed.');
if(NativeDocuments::reconcileTicketTotals(array_reverse($details),222,201,2)!==array_reverse($balanced))throw new RuntimeException('Ticket allocation depends on detail ordering.');
$duplicate=$details;$duplicate[1]['product_id']=1;
$negativeTax=$details;$negativeTax[1]['total_price_tax_incl']='0.500000';
$invalidAmount=$details;$invalidAmount[0]['total_price_tax_excl']='invalid';
foreach([
 ['changed gross total',$details,223,201],
 ['changed net total',$details,222,202],
 ['duplicate product and attribute',$duplicate,222,201],
 ['negative tax',$negativeTax,151,201],
 ['invalid native amount',$invalidAmount,222,201],
] as [$label,$rows,$gross,$net]){
 $rejected=false;
 try{NativeDocuments::reconcileTicketTotals($rows,$gross,$net,2);}catch(InvalidArgumentException $e){$rejected=true;}
 if(!$rejected)throw new RuntimeException('Ticket silently accepted '.$label);
}
echo 'PASS mismatched native totals, duplicate lines and invalid tax/amounts are rejected.'.PHP_EOL;
mt_srand(41);
for($i=0;$i<1000;$i++){
 $rows=[];$net=0;$gross=0;
 for($j=0,$length=mt_rand(1,8);$j<$length;$j++){$n=mt_rand(0,100000);$g=$n+mt_rand(0,30000);$net+=$n;$gross+=$g;$rows[]=['product_id'=>$j+1,'product_attribute_id'=>0,'total_price_tax_excl'=>number_format($n/1000000,6,'.',''),'total_price_tax_incl'=>number_format($g/1000000,6,'.','')];}
 foreach(range(0,5) as $mode){$n=NativeDocuments::amountCents($net/1000000,$mode);$g=NativeDocuments::amountCents($gross/1000000,$mode);$actual=NativeDocuments::reconcileTicketTotals($rows,$g,$n,$mode);
  if(array_sum(array_column($actual,'line_cents'))!==$g||array_sum(array_column($actual,'tax_excl_cents'))!==$n||min(array_column($actual,'tax_cents'))<0)throw new RuntimeException('Ticket totals or tax changed.');
 }
}
echo 'PASS native ticket allocation: exact net/gross totals, no negative tax, stable ordering and 6000 fractional baskets.'.PHP_EOL;
