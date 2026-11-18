<?php
namespace TotusCentralConnector;

/** Read metadata of an already issued invoice belonging to a verified native
 * sale. Never allocate a number, issue an invoice or read current Product/Tax
 * prices. The PDF remains the document served by NativeDocuments. */
final class NativeBilling
{
    public static function read($module,array $profile,array $query,int $account): array
    {
        $id=$query['operation_id']??'';$actor=$query['actor_id']??'';
        Protocol::ensure(Protocol::uuid($id)&&Protocol::uuid($actor)&&($query['kind']??null)==='billing','BILLING_QUERY_INVALID');
        $operation=NativeRuntime::readOperation($module,$profile,$id,$actor,$account);
        $sale=$operation['result']??null;
        Protocol::ensure(($operation['status']??null)==='verified'&&is_array($sale)&&is_int($sale['order_id']??null)&&$sale['order_id']>0&&
            is_array($sale['invoice_ids']??null)&&count($sale['invoice_ids'])===1&&is_int($sale['invoice_ids'][0])&&$sale['invoice_ids'][0]>0,'BILLING_VERIFIED_SALE_REQUIRED');
        return self::invoice(new \Order($sale['order_id']),new \OrderInvoice($sale['invoice_ids'][0]),$sale,$profile);
    }

    public static function invoice(\Order $order,\OrderInvoice $invoice,array $sale,array $profile): array
    {
        Protocol::ensure(\Validate::isLoadedObject($order)&&\Validate::isLoadedObject($invoice)&&
            (int)$order->id_shop===(int)$profile['shop_id']&&(int)$invoice->id_order===(int)$order->id&&
            (int)$invoice->number>0&&($sale['order_id']??null)===(int)$order->id&&($sale['invoice_ids']??null)===[(int)$invoice->id],
            'BILLING_INVOICE_OWNERSHIP_REQUIRED');
        $currency=new \Currency((int)$order->id_currency);
        Protocol::ensure(\Validate::isLoadedObject($currency)&&preg_match('/^[A-Z]{3}$/D',(string)$currency->iso_code)===1,'BILLING_CURRENCY_INVALID');
        $total=self::decimal($invoice->total_paid_tax_incl);
        Protocol::ensure(is_int($sale['total_cents']??null)&&(int)round((float)$total*100)===$sale['total_cents'],'BILLING_TOTAL_MISMATCH');
        $rows=$order->getOrderDetailList();Protocol::ensure(is_array($rows)&&count($rows)>0&&count($rows)<=200,'BILLING_LINES_INVALID');
        $lines=[];
        foreach($rows as $row){
            Protocol::ensure((int)($row['id_order']??0)===(int)$order->id&&(int)($row['id_order_invoice']??0)===(int)$invoice->id&&
                (int)($row['id_order_detail']??0)>0&&(int)($row['product_id']??0)>0&&(int)($row['product_quantity']??0)>0&&
                (int)$row['product_quantity']<=10000,'BILLING_LINE_OWNERSHIP_REQUIRED');
            $lines[]=['detail_id'=>(int)$row['id_order_detail'],'product_id'=>(int)$row['product_id'],
                'attribute_id'=>(int)($row['product_attribute_id']??0),'name'=>self::text($row['product_name']??'',512),
                'quantity'=>(int)$row['product_quantity'],
                'unit_tax_excl'=>self::decimal($row['unit_price_tax_excl']??null),
                'unit_tax_incl'=>self::decimal($row['unit_price_tax_incl']??null),
                'line_tax_excl'=>self::decimal($row['total_price_tax_excl']??null),
                'line_tax_incl'=>self::decimal($row['total_price_tax_incl']??null),
                // Persisted on OrderDetail at issuance; do not instantiate
                // today's Tax calculator to reconstruct a historical rate.
                'recorded_tax_rate'=>self::decimal($row['tax_rate']??null),
                'recorded_ecotax'=>self::decimal($row['ecotax']??null),
                'recorded_ecotax_tax_rate'=>self::decimal($row['ecotax_tax_rate']??null)];
        }
        return ['source'=>'native-billing-document','kind'=>'billing','existing_document'=>true,
            'order_id'=>(int)$order->id,'order_reference'=>self::text($order->reference,32),
            'invoice_id'=>(int)$invoice->id,'number'=>(int)$invoice->number,
            // Use the same native formatter as PrestaShop's PDF. A custom
            // formatter or prefix change belongs to the native configuration.
            'formatted_number'=>self::text($invoice->getInvoiceNumberFormatted((int)$order->id_lang,(int)$order->id_shop),128),
            'issued_at'=>self::text($invoice->date_add,32),'currency'=>(string)$currency->iso_code,
            'customer_id'=>(int)$order->id_customer,'invoice_address_id'=>(int)$order->id_address_invoice,
            'total_cents'=>$sale['total_cents'],'total_tax_incl'=>$total,
            'total_tax_excl'=>self::decimal($invoice->total_paid_tax_excl),
            'discount_tax_incl'=>self::decimal($invoice->total_discount_tax_incl),
            'discount_tax_excl'=>self::decimal($invoice->total_discount_tax_excl),
            'shipping_tax_incl'=>self::decimal($invoice->total_shipping_tax_incl),
            'shipping_tax_excl'=>self::decimal($invoice->total_shipping_tax_excl),
            'lines'=>$lines];
    }
    private static function decimal($value): string
    {
        Protocol::ensure((is_string($value)||is_int($value)||is_float($value))&&is_numeric($value)&&is_finite((float)$value)&&
            (float)$value>=0&&(float)$value<=1000000000,'BILLING_AMOUNT_INVALID');
        return number_format((float)$value,6,'.','');
    }
    private static function text($value,int $maximum): string
    {
        Protocol::ensure(is_string($value)&&preg_match('//u',$value)===1&&preg_match_all('/./us',$value)<=$maximum&&
            !preg_match('/[\x00-\x1f\x7f]/u',$value),'BILLING_TEXT_INVALID');return $value;
    }
}
