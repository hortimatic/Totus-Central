<?php
namespace TotusCentralConnector;

/** Re-read existing native documents. Rendering never creates an invoice,
 * payment, order or number, and never calls setInvoice/setDelivery. */
final class NativeDocuments
{
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
        $lines=[];foreach($order->getOrderDetailList() as $line)$lines[]=['name'=>(string)$line['product_name'],
            'reference'=>(string)$line['product_reference'],'quantity'=>(int)$line['product_quantity'],
            ...($kind==='gift'?[]:['line_cents'=>(int)round(100*(float)$line['total_price_tax_incl']),
                'tax_excl_cents'=>(int)round(100*(float)$line['total_price_tax_excl'])])];
        return ['kind'=>$kind,'order_id'=>(int)$order->id,'reference'=>(string)$order->reference,'created_at'=>(string)$order->date_add,
            'reference_barcode'=>self::referenceBarcode((string)$order->reference),
            'merchant'=>$merchant+['logo_path'=>self::merchantLogoPath(\Configuration::get('PS_SHOP_LOGO',null,null,(int)$order->id_shop))],
            ...($kind==='gift'?[]:['customer'=>self::customerForOrder($order,(int)($profile['counter_customer_id']??0))]),
            'currency'=>(new \Currency((int)$order->id_currency))->iso_code,'lines'=>$lines,
            ...($kind==='gift'?[]:['total_cents'=>(int)$sale['total_cents'],'discount_cents'=>(int)round(100*(float)$order->total_discounts_tax_incl),
                'payments'=>$sale['payments'],'payment_intent'=>$sale['payment_intent']]),
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
