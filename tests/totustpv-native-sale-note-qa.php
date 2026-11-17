<?php
require __DIR__.'/../connectors/prestashop/src/Protocol.php';
require __DIR__.'/../connectors/prestashop/src/NativeSaleNote.php';
use TotusCentralConnector\NativeSaleNote;
function noteCheck($ok){if(!$ok)throw new RuntimeException('Private sale note contract failed');}
noteCheck(NativeSaleNote::normalize(null)===null);
noteCheck(NativeSaleNote::normalize("  \r\n  ")===null);
noteCheck(NativeSaleNote::normalize("  Entrega el miércoles\r\nLlamar antes\t🙂  ")==="Entrega el miércoles\nLlamar antes\t🙂");
noteCheck(NativeSaleNote::normalize(str_repeat('🙂',500))===str_repeat('🙂',500));
foreach([[],1,str_repeat('🙂',501),"texto\x00","texto\x7f",'<script>hola</script>','2 > 1',"\xc3\x28"] as $value){$rejected=false;try{NativeSaleNote::normalize($value);}catch(Throwable $error){$rejected=str_contains($error->getMessage(),'SALE_NOTE_INVALID');}noteCheck($rejected);}
echo "PASS private native sale-note normalization, Unicode limits and invalid input.\n";
