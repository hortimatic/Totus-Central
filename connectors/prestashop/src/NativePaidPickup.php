<?php
namespace TotusCentralConnector;

/** The single supported preparing → paid-and-delivered pickup transition.
 * Public native ObjectModels create the invoice, link existing payments,
 * delivery document, sales statistics and history on the current native PDO.
 * The generic shipping transition also flushes a separate Doctrine connection;
 * this command deliberately owns its native stock movement in NativeSale.
 * No core override, temporary state/configuration change or container swap.
 */
final class NativePaidPickup
{
    public static function complete(\Order $order,\OrderState $preparing,\OrderState $paid): void
    {
        $db=\Db::getInstance()->getLink();
        Protocol::ensure($db instanceof \PDO&&$db->inTransaction()&&_PS_VERSION_==='8.2.8','PICKUP_TRANSACTION_REQUIRED');
        Protocol::ensure((int)$order->current_state===(int)$preparing->id&&!$preparing->paid&&!$preparing->logable&&
            !$preparing->invoice&&!$preparing->shipped&&$paid->paid&&$paid->logable&&$paid->invoice&&$paid->delivery&&
            $paid->shipped&&!$paid->send_email&&count($order->getInvoicesCollection())===0,'PICKUP_STATE_INVALID');
        \ShopUrl::cacheMainDomainForShop((int)$order->id_shop);
        try{
            \Hook::exec('actionOrderStatusUpdate',['newOrderStatus'=>$paid,'oldOrderStatus'=>$preparing,'id_order'=>(int)$order->id],
                null,false,true,false,(int)$order->id_shop);
            foreach($order->getOrderDetailList() as $line)Protocol::ensure(
                \ProductSale::addProductSale((int)$line['product_id'],(int)$line['product_quantity']),'PICKUP_SALES_STATISTICS_FAILED');
            $order->current_state=(int)$paid->id;$order->valid=true;
            Protocol::ensure($order->update(),'PICKUP_STATE_SAVE_FAILED');
            // Payments have already been recorded once by NativeSale. Link
            // those records; never manufacture a balancing payment here.
            $order->setInvoice(true);$invoices=$order->getInvoicesCollection();
            Protocol::ensure(count($invoices)===1,'PICKUP_INVOICE_REQUIRED');
            foreach($invoices as $invoice)Protocol::ensure(abs((float)$invoice->getRestPaid())<0.000001,'PICKUP_UNSETTLED_INVOICE');
            $order->setDelivery();
            $history=new \OrderHistory();$history->id_order=(int)$order->id;$history->id_order_state=(int)$paid->id;
            $history->id_employee=0;Protocol::ensure($history->add(),'PICKUP_HISTORY_FAILED');
            \Hook::exec('actionOrderStatusPostUpdate',['newOrderStatus'=>$paid,'oldOrderStatus'=>$preparing,'id_order'=>(int)$order->id],
                null,false,true,false,(int)$order->id_shop);
        }finally{\ShopUrl::resetMainDomainCache();}
    }
}
