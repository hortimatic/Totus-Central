<?php
namespace TotusCentralConnector;

/** Canonical plain private text, sealed with the owned cart, never public mail. */
final class NativeSaleNote
{
    public static function normalize($value): ?string
    {
        if ($value===null) return null;
        Protocol::ensure(is_string($value),'SALE_NOTE_INVALID');
        Protocol::ensure(preg_match('//u',$value)===1,'SALE_NOTE_INVALID');
        $note=preg_replace('/^[ \t\n]+|[ \t\n]+$/u','',str_replace(["\r\n","\r"],"\n",$value));
        Protocol::ensure(is_string($note)&&!preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f<>]/u',$note),'SALE_NOTE_INVALID');
        Protocol::ensure(preg_match_all('/./us',$note)<=500,'SALE_NOTE_INVALID');
        return $note===''?null:$note;
    }
    public static function verifyOrder($order,$value,string $fingerprint): void
    {
        $note=self::normalize($value);
        Protocol::ensure($note!==null&&hash_equals($fingerprint,hash('sha256',$note)),'SALE_NOTE_MISMATCH');
        $db=\Db::getInstance()->getLink();
        $statement=$db->prepare('SELECT message,private,id_cart,id_customer FROM `'._DB_PREFIX_.'message` WHERE id_order=?');
        $statement->execute([(int)$order->id]);$matches=0;
        foreach($statement->fetchAll(\PDO::FETCH_ASSOC) as $message){
            if((string)$message['message']!==$note)continue;
            Protocol::ensure((bool)$message['private']&&(int)$message['id_cart']===(int)$order->id_cart&&
                (int)$message['id_customer']===(int)$order->id_customer,'SALE_NOTE_PRIVATE_READBACK_FAILED');
            $matches++;
        }
        Protocol::ensure($matches===1,'SALE_NOTE_PRIVATE_READBACK_FAILED');
    }
}
