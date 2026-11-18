<?php
namespace TotusCentralConnector;

/** Re-read existing native documents. Rendering never creates an invoice,
 * payment, order or number, and never calls setInvoice/setDelivery. */
final class NativeDocuments
{
    /** Read historical order reductions, never the current voucher definition.
     * An incomplete breakdown must not imply a different discount total. */
    public static function voucherSnapshot($rules,int $totalCents,int $mode): array
    {
        $unavailable=['vouchers'=>[],'vouchers_complete'=>false];
        if(!is_array($rules)||count($rules)>200)return $unavailable;
        $rows=[];$sum=0;
        foreach($rules as $rule){
            if(!is_array($rule)||!isset($rule['name'],$rule['value'])||!is_string($rule['name'])||strlen($rule['name'])>1024)return $unavailable;
            if(!empty($rule['deleted']))continue;
            try{$cents=self::amountCents($rule['value'],$mode);}catch(\InvalidArgumentException $e){return $unavailable;}
            $sum+=$cents;if($cents>0)$rows[]=['name'=>$rule['name'],'amount_cents'=>$cents];
        }
        return $sum===$totalCents?['vouchers'=>$rows,'vouchers_complete'=>true]:$unavailable;
    }
    public static function amountCents($amount,int $roundMode): int
    {
        if(!is_numeric($amount)||!is_finite((float)$amount)||(float)$amount<0||(float)$amount>1000000000||$roundMode<0||$roundMode>5)
            throw new \InvalidArgumentException('DOCUMENT_AMOUNT_INVALID');
        return (int)round(100*\Tools::ps_round((float)$amount,2,$roundMode));
    }
    /** Presentation allocation only; historical amounts and paid totals never change. */
    public static function reconcileTicketTotals(array $details,int $grossCents,int $netCents,int $mode): array
    {
        if(!$details||count($details)>200||$netCents<0||$grossCents<$netCents)throw new \InvalidArgumentException('DOCUMENT_SUBTOTAL_INVALID');
        $rows=[];$seen=[];$netSum=0;$grossSum=0;
        foreach($details as $index=>$line){
            $key=(int)$line['product_id'].':'.(int)$line['product_attribute_id'];
            if(isset($seen[$key])||(int)$line['product_id']<1||(int)$line['product_attribute_id']<0)throw new \InvalidArgumentException('DOCUMENT_LINES_INVALID');
            $seen[$key]=true;$amounts=[];
            foreach(['total_price_tax_excl','total_price_tax_incl'] as $field){
                if(!preg_match('/^(0|[1-9][0-9]*)(?:\.([0-9]{1,6}))?$/D',(string)($line[$field]??''),$match)||(float)$line[$field]>1000000000)throw new \InvalidArgumentException('DOCUMENT_AMOUNT_INVALID');
                $amounts[]=(int)$match[1]*1000000+(int)str_pad($match[2]??'',6,'0');
            }
            [$net,$gross]=$amounts;if($net>$gross)throw new \InvalidArgumentException('DOCUMENT_TAX_INVALID');
            $rows[$index]=['key'=>$key,'netMicros'=>$net,'grossMicros'=>$gross,'net'=>intdiv($net,10000)];$netSum+=$net;$grossSum+=$gross;
        }
        if(self::amountCents($netSum/1000000,$mode)!==$netCents||self::amountCents($grossSum/1000000,$mode)!==$grossCents)throw new \InvalidArgumentException('DOCUMENT_SUBTOTAL_MISMATCH');
        $rank=function(string $field)use(&$rows):array{$indices=array_keys($rows);usort($indices,static function($a,$b)use(&$rows,$field){return ($rows[$b][$field]%10000)<=>($rows[$a][$field]%10000)?:strcmp($rows[$a]['key'],$rows[$b]['key']);});return $indices;};
        $remaining=$netCents-array_sum(array_column($rows,'net'));
        foreach($rank('netMicros') as $index){if($remaining===0)break;$rows[$index]['net']++;$remaining--;}
        if($remaining!==0)throw new \InvalidArgumentException('DOCUMENT_SUBTOTAL_MISMATCH');
        foreach($rows as &$row)$row['gross']=$row['netMicros']===$row['grossMicros']?$row['net']:max(intdiv($row['grossMicros'],10000),$row['net']);unset($row);
        $remaining=$grossCents-array_sum(array_column($rows,'gross'));
        foreach($rank('grossMicros') as $index){
            if($remaining===0)break;$row=&$rows[$index];
            if($row['grossMicros']!==$row['netMicros']&&$row['gross']<intdiv($row['grossMicros']+9999,10000)){$row['gross']++;$remaining--;}
            unset($row);
        }
        if($remaining!==0)throw new \InvalidArgumentException('DOCUMENT_TAX_ALLOCATION_INVALID');
        foreach($rows as &$row)$row=['line_cents'=>$row['gross'],'tax_excl_cents'=>$row['net'],'tax_cents'=>$row['gross']-$row['net']];unset($row);
        return $rows;
    }
    /** Missing legacy metadata keeps the original OrderDetail name intact. */
    public static function historicalLinePresentation(array $sale,array $line): array
    {
        $found=[];
        if(!is_array($sale['line_presentations']??[]))return [];
        foreach(($sale['line_presentations']??[]) as $saved){
            if(!is_array($saved)||($saved['product_id']??null)!==(int)$line['product_id']||
                ($saved['attribute_id']??null)!==(int)$line['product_attribute_id'])continue;
            if($found)return [];
            $presentation=$saved['presentation']??null;
            if(!is_array($presentation)||!is_string($presentation['base_name']??null)||trim($presentation['base_name'])===''||
                !is_string($presentation['variant_name']??null))return [];
            foreach($presentation as $text)if(!is_string($text)||preg_match('//u',$text)!==1||preg_match_all('/./us',$text)>512||preg_match('/[\x00-\x1f\x7f]/u',$text))return [];
            $found=['base_name'=>$presentation['base_name'],'variant_name'=>$presentation['variant_name']];
        }
        return $found;
    }
    /** Historical OrderDetail values only: never consult today's Product/Tax. */
    public static function linePricingSnapshot(array $line,int $roundMode,int $roundType): array
    {
        foreach(['original_product_price','tax_rate','ecotax','ecotax_tax_rate','total_price_tax_incl','product_quantity'] as $key)
            if(!isset($line[$key])||!is_numeric($line[$key])||!is_finite((float)$line[$key])||(float)$line[$key]<0)return [];
        $quantity=(int)$line['product_quantity'];$base=(float)$line['original_product_price'];$eco=(float)$line['ecotax'];
        if($quantity<1||$quantity>10000||$base<$eco||!in_array($roundType,[1,2,3],true)||$roundMode<0||$roundMode>5)return [];
        // The native original price includes ecotax without its tax. Its two
        // historical rates can differ, so apply each recorded component.
        $original=\Tools::ps_round(($base-$eco)*(1+(float)$line['tax_rate']/100)+$eco*(1+(float)$line['ecotax_tax_rate']/100),6,$roundMode);
        $lineOriginal=$roundType===\Order::ROUND_ITEM?\Tools::ps_round($original,2,$roundMode)*$quantity:\Tools::ps_round($original*$quantity,2,$roundMode);
        $unitMicros=round($original*1000000);$lineCents=round($lineOriginal*100);$paidCents=self::amountCents($line['total_price_tax_incl'],$roundMode);
        if($unitMicros>9007199254740991||$lineCents>9007199254740991||$paidCents>9007199254740991)return [];
        return ['original_unit_tax_incl_micros'=>(int)$unitMicros,'original_line_cents'=>(int)$lineCents,
            'line_discount_cents'=>max(0,(int)$lineCents-(int)$paidCents)];
    }
    public static function merchantLogoPath($filename): ?string
    {return is_string($filename)&&preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,179}\.(png|jpe?g|gif|webp)$/iD',$filename)===1?'/img/'.$filename:null;}
    public static function referenceBarcode($reference): ?array
    {
        // The R: namespace distinguishes an order reference from a numeric
        // order ID or product scan. Keep modules readable on 58 mm paper.
        if(!is_string($reference)||preg_match('/^[A-Za-z0-9-]{1,10}$/D',$reference)!==1||!class_exists('TCPDFBarcode')||!function_exists('imagecreatefromstring'))return null;
        try{$payload='R:'.$reference;$png=(new \TCPDFBarcode($payload,'C128'))->getBarcodePngData(3,80,[0,0,0]);
            if(!is_string($png)||strlen($png)>60000||!str_starts_with($png,"\x89PNG\r\n\x1a\n"))return null;
            $bars=imagecreatefromstring($png);if(!$bars)return null;
            // Ten narrow modules of white space on both sides are part of
            // the image, so printed/exported copies retain their quiet zones.
            $image=imagecreatetruecolor(imagesx($bars)+60,imagesy($bars));
            imagefill($image,0,0,imagecolorallocate($image,255,255,255));imagecopy($image,$bars,30,0,0,0,imagesx($bars),imagesy($bars));
            $stream=fopen('php://temp','w+b');if($stream===false)return null;
            imagepng($image,$stream);rewind($stream);$png=stream_get_contents($stream);fclose($stream);
            imagedestroy($bars);imagedestroy($image);
            if(!is_string($png)||strlen($png)>60000)return null;
            return ['format'=>'Code128','mime'=>'image/png','text'=>$reference,'payload'=>$payload,'data'=>base64_encode($png)];
        }catch(\Throwable $error){return null;}
    }
    public static function customerForOrder(\Order $order,int $counterCustomer): ?array
    {
        Protocol::ensure(\Validate::isLoadedObject($order),'DOCUMENT_ORDER_INVALID');
        if((int)$order->id_customer===$counterCustomer)return null;
        $customer=new \Customer((int)$order->id_customer);
        if(!\Validate::isLoadedObject($customer))return null;
        $addresses=[];
        foreach(['invoice'=>'id_address_invoice','delivery'=>'id_address_delivery'] as $kind=>$field){
            $address=new \Address((int)$order->$field);
            if(!\Validate::isLoadedObject($address)||(int)$address->id_customer!==(int)$customer->id)return null;
            $country=new \Country((int)$address->id_country,(int)$order->id_lang);
            $addresses[$kind]=['name'=>trim($address->firstname.' '.$address->lastname),'company'=>(string)$address->company,
                'address1'=>(string)$address->address1,'address2'=>(string)$address->address2,'postcode'=>(string)$address->postcode,
                'city'=>(string)$address->city,'country'=>\Validate::isLoadedObject($country)?(string)$country->name:'',
                'phone'=>implode(' / ',array_unique(array_filter([(string)$address->phone,(string)$address->phone_mobile]))),
                'comment'=>(string)$address->other];
        }
        // Explicit printable fields only: never serialize the Customer object,
        // authentication fields, security keys or unrelated addresses.
        return ['email'=>(string)$customer->email]+$addresses;
    }
    public static function read($module,array $profile,array $query,int $account): array
    {
        $id=$query['operation_id']??'';$actor=$query['actor_id']??'';$kind=$query['kind']??'receipt';
        Protocol::ensure(Protocol::uuid($id)&&Protocol::uuid($actor)&&in_array($kind,['receipt','gift','invoice','delivery','credit-note'],true),
            'DOCUMENT_QUERY_INVALID');
        $operation=NativeRuntime::readOperation($module,$profile,$id,$actor,$account);$sale=$operation['result']??null;
        if($kind==='credit-note'){
            Protocol::ensure(($operation['status']??null)==='verified'&&isset($sale['sale_operation_id'],$sale['order_id'])&&
                is_array($sale['credit_note_ids']??null)&&count($sale['credit_note_ids'])>0&&count($sale['credit_note_ids'])<=20,
                'DOCUMENT_VERIFIED_RETURN_REQUIRED');
            $order=new \Order((int)$sale['order_id']);
            Protocol::ensure(\Validate::isLoadedObject($order)&&(int)$order->id_shop===(int)$profile['shop_id'],'DOCUMENT_ORDER_INVALID');
            $slips=[];foreach($sale['credit_note_ids'] as $creditId){$slip=new \OrderSlip((int)$creditId);
                Protocol::ensure(\Validate::isLoadedObject($slip)&&(int)$slip->id_order===(int)$order->id,'DOCUMENT_NOT_AVAILABLE');$slips[]=$slip;}
            $pdf=new \PDF($slips,\PDF::TEMPLATE_ORDER_SLIP,\Context::getContext()->smarty);
            return self::pdf($pdf,$kind,(int)$order->id);
        }
        Protocol::ensure(($operation['status']??null)==='verified'&&isset($sale['order_id'],$sale['invoice_ids'])&&
            count($sale['invoice_ids'])===1,'DOCUMENT_VERIFIED_SALE_REQUIRED');
        $order=new \Order((int)$sale['order_id']);
        Protocol::ensure(\Validate::isLoadedObject($order)&&(int)$order->id_shop===(int)$profile['shop_id'],'DOCUMENT_ORDER_INVALID');
        if(in_array($kind,['invoice','delivery'],true)){
            $invoice=new \OrderInvoice((int)$sale['invoice_ids'][0]);
            Protocol::ensure(\Validate::isLoadedObject($invoice)&&(int)$invoice->id_order===(int)$order->id&&
                (int)$invoice->number>0&&($kind!=='delivery'||(int)$invoice->delivery_number>0),'DOCUMENT_NOT_AVAILABLE');
            $pdf=new \PDF([$invoice],$kind==='invoice'?\PDF::TEMPLATE_INVOICE:\PDF::TEMPLATE_DELIVERY_SLIP,\Context::getContext()->smarty);
            return self::pdf($pdf,$kind,(int)$order->id);
        }
        $merchant=[];foreach(['name'=>'PS_SHOP_NAME','address'=>'PS_SHOP_ADDR1','address2'=>'PS_SHOP_ADDR2','postcode'=>'PS_SHOP_CODE',
            'city'=>'PS_SHOP_CITY','phone'=>'PS_SHOP_PHONE','registration'=>'PS_SHOP_REGISTRATION_NUMBER'] as $key=>$configuration)
            $merchant[$key]=(string)\Configuration::get($configuration,null,null,(int)$order->id_shop);
        $details=$order->getOrderDetailList();$balanced=$kind!=='gift'&&(int)$order->round_type===3?self::reconcileTicketTotals($details,self::amountCents($order->total_products_wt,(int)$order->round_mode),self::amountCents($order->total_products,(int)$order->round_mode),(int)$order->round_mode):[];
        $lines=[];foreach($details as $index=>$line)$lines[]=['name'=>(string)$line['product_name'],
            ...self::historicalLinePresentation($sale,$line),
            'reference'=>(string)$line['product_reference'],'quantity'=>(int)$line['product_quantity'],
            ...($kind==='gift'?[]:['line_cents'=>$balanced[$index]['line_cents']??self::amountCents($line['total_price_tax_incl'],(int)$order->round_mode),
                'unit_tax_incl_micros'=>(int)round(1000000*(float)$line['unit_price_tax_incl']),
                'tax_cents'=>$balanced[$index]['tax_cents']??(self::amountCents($line['total_price_tax_incl'],(int)$order->round_mode)-self::amountCents($line['total_price_tax_excl'],(int)$order->round_mode)),
                'tax_excl_cents'=>$balanced[$index]['tax_excl_cents']??self::amountCents($line['total_price_tax_excl'],(int)$order->round_mode),...self::linePricingSnapshot($line,(int)$order->round_mode,(int)$order->round_type)])];
        return ['kind'=>$kind,'order_id'=>(int)$order->id,'reference'=>(string)$order->reference,'created_at'=>(string)$order->date_add,
            'reference_barcode'=>self::referenceBarcode((string)$order->reference),
            'merchant'=>$merchant+['logo_path'=>self::merchantLogoPath(\Configuration::get('PS_SHOP_LOGO',null,null,(int)$order->id_shop))],
            ...($kind==='gift'?[]:['customer'=>self::customerForOrder($order,(int)($profile['counter_customer_id']??0))]),
            'currency'=>(new \Currency((int)$order->id_currency))->iso_code,'lines'=>$lines,
            ...($kind==='gift'?[]:['total_cents'=>(int)$sale['total_cents'],'discount_cents'=>self::amountCents($order->total_discounts_tax_incl,(int)$order->round_mode),
                'payments'=>$sale['payments'],'payment_intent'=>$sale['payment_intent'],
                ...self::voucherSnapshot($order->getCartRules(),self::amountCents($order->total_discounts_tax_incl,(int)$order->round_mode),(int)$order->round_mode),
                'line_discounts_complete'=>count(array_filter($lines,static fn($line)=>isset($line['line_discount_cents'])))===count($lines),
                'line_discount_cents'=>array_sum(array_column($lines,'line_discount_cents'))]),
            'invoice_id'=>(int)$sale['invoice_ids'][0],'existing_document'=>true,'environment'=>'qa'];
    }
    private static function pdf(\PDF $pdf,string $kind,int $orderId): array
    {
        $bytes=$pdf->render(false);
        Protocol::ensure(is_string($bytes)&&str_starts_with($bytes,'%PDF-')&&strlen($bytes)<=1400000,'DOCUMENT_RENDER_FAILED');
        return ['kind'=>$kind,'order_id'=>$orderId,'mime'=>'application/pdf','filename'=>'totus-'.$kind.'-'.$orderId.'.pdf',
            'base64'=>base64_encode($bytes),'sha256'=>hash('sha256',$bytes),'existing_document'=>true];
    }
}
