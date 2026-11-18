<?php
namespace TotusCentralConnector;

/** Owned immutable intent, committed BEFORE the native product update. It is
 * deliberately separate from verified business receipts. GET recovery can
 * reconstruct the exact command without accepting a new browser payload. */
final class NativeBarcodeIntents
{
    private \PDO $db;private string $table;
    public function __construct(\PDO $db,string $table)
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1&&!$db->inTransaction(),'BARCODE_INTENT_CONFIG_INVALID');
        $this->db=$db;$this->table='`'.$table.'`';
    }
    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'BARCODE_INTENT_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (operation_id CHAR(36) NOT NULL PRIMARY KEY,
            command_json MEDIUMTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)
            ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
    private static function validate(array $command): void
    {
        $signed=$command;unset($signed['fingerprint']);
        Protocol::ensure(($command['protocol']??null)===1&&($command['command']??null)==='barcodes.assign'&&
            Protocol::uuid($command['operation_id']??null)&&Protocol::uuid($command['installation_id']??null)&&Protocol::uuid($command['actor_id']??null)&&
            is_int($command['shop_id']??null)&&$command['shop_id']>0&&is_int($command['api_account_id']??null)&&$command['api_account_id']>0&&
            is_string($command['fingerprint']??null)&&hash_equals(hash('sha256',Protocol::canonical($signed)),$command['fingerprint']),
            'BARCODE_INTENT_INVALID');
    }
    public function record(array $command): void
    {
        self::validate($command);Protocol::ensure(!$this->db->inTransaction(),'JOURNAL_REQUIRES_AUTOCOMMIT');
        $json=Protocol::canonical($command);Protocol::ensure(strlen($json)<=Protocol::MAX_BODY_BYTES+256,'BODY_TOO_LARGE');
        try{$statement=$this->db->prepare('INSERT INTO '.$this->table.' (operation_id,command_json) VALUES (?,?)');$statement->execute([$command['operation_id'],$json]);}
        catch(\PDOException $error){if(!in_array($error->getCode(),['23000','23505'],true))throw $error;}
        $saved=$this->read($command['operation_id']);
        Protocol::ensure($saved!==null&&Protocol::canonical($saved)===$json,'OPERATION_ID_ALREADY_BOUND');
    }
    public function read(string $operationId): ?array
    {
        Protocol::ensure(Protocol::uuid($operationId),'IDENTITY_INVALID');
        $statement=$this->db->prepare('SELECT command_json FROM '.$this->table.' WHERE operation_id=?');$statement->execute([$operationId]);$json=$statement->fetchColumn();
        if($json===false)return null;
        $command=json_decode($json,true,32,JSON_THROW_ON_ERROR);Protocol::ensure(is_array($command),'BARCODE_INTENT_INVALID');self::validate($command);
        Protocol::ensure($command['operation_id']===$operationId,'BARCODE_INTENT_INVALID');return $command;
    }
}
