<?php
namespace TotusCentralConnector;

/** Persist a native SQL effect and its receipt on the SAME native PDO handle.
 * The separate dispatch journal is committed first. A rollback does not permit
 * another dispatch. Hooks, mail and external systems are NOT made transactional
 * by this wrapper; their failure remains uncertain and must never trigger replay.
 * Handlers must still reread the native business records during reconciliation.
 */
final class PdoNativeEffect
{
    private \PDO $native;
    private string $table;
    private PdoJournal $journal;
    private $nativeHandle;

    public function __construct(\PDO $native,string $table,PdoJournal $journal,callable $nativeHandle)
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'EFFECT_CONFIG_INVALID');
        Protocol::ensure($nativeHandle()===$native && !$native->inTransaction(),'NATIVE_PDO_REQUIRED');
        $native->setAttribute(\PDO::ATTR_ERRMODE,\PDO::ERRMODE_EXCEPTION);
        $this->native=$native;$this->table='`'.$table.'`';$this->journal=$journal;$this->nativeHandle=$nativeHandle;
    }

    public static function mysqlSchema(string $table): string
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D',$table)===1,'EFFECT_CONFIG_INVALID');
        return 'CREATE TABLE `'.$table.'` (
            operation_id CHAR(36) NOT NULL PRIMARY KEY, installation_id CHAR(36) NOT NULL,
            api_account_id BIGINT UNSIGNED NOT NULL,shop_id BIGINT UNSIGNED NOT NULL,
            actor_id CHAR(36) NOT NULL,command VARCHAR(32) NOT NULL,fingerprint CHAR(64) NOT NULL,
            result_json MEDIUMTEXT NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }

    public function run(array $command,string $claimToken,callable $effect): array
    {
        $this->journal->assertClaim($command,$claimToken);
        Protocol::ensure(($this->nativeHandle)()===$this->native && !$this->native->inTransaction(),'NATIVE_PDO_REQUIRED');
        Protocol::ensure($this->receipt($command)===null,'EFFECT_ALREADY_COMMITTED');
        $this->native->beginTransaction();
        try {
            $result=$effect();
            // A native hook that committed/replaced the connection breaks the
            // guarantee. Refuse success and let the durable claim remain pending.
            Protocol::ensure(($this->nativeHandle)()===$this->native && $this->native->inTransaction(),'NATIVE_TRANSACTION_INTERRUPTED');
            Protocol::ensure(is_array($result)&&($result['verified']??false)===true,'READBACK_REQUIRED');
            $serialized=Protocol::canonical($result);
            Protocol::ensure(strlen($serialized)<=Protocol::MAX_BODY_BYTES,'RESULT_TOO_LARGE');
            $statement=$this->native->prepare('INSERT INTO '.$this->table.'
                (operation_id,installation_id,api_account_id,shop_id,actor_id,command,fingerprint,result_json)
                VALUES (:operation,:installation,:account,:shop,:actor,:command,:fingerprint,:result)');
            $statement->execute(['operation'=>$command['operation_id'],'installation'=>$command['installation_id'],
                'account'=>$command['api_account_id'],'shop'=>$command['shop_id'],'actor'=>$command['actor_id'],
                'command'=>$command['command'],'fingerprint'=>$command['fingerprint'],'result'=>$serialized]);
            $this->native->commit();
            return $result;
        } catch(\Throwable $error) {
            if($this->native->inTransaction())$this->native->rollBack();
            throw $error;
        }
    }

    /** Read-only receipt lookup. This is evidence of a committed transaction,
     * not a substitute for checking that native orders/payments still match. */
    public function receipt(array $command): ?array
    {
        Protocol::ensure(Protocol::uuid($command['operation_id']??null),'IDENTITY_INVALID');
        Protocol::ensure(!$this->native->inTransaction(),'EFFECT_READ_REQUIRES_AUTOCOMMIT');
        $statement=$this->native->prepare('SELECT * FROM '.$this->table.' WHERE operation_id=:operation');
        $statement->execute(['operation'=>$command['operation_id']]);$row=$statement->fetch(\PDO::FETCH_ASSOC);
        if(!$row)return null;
        Protocol::ensure($row['installation_id']===($command['installation_id']??null) &&
            (int)$row['api_account_id']===($command['api_account_id']??null) &&
            (int)$row['shop_id']===($command['shop_id']??null) && $row['actor_id']===($command['actor_id']??null) &&
            $row['command']===($command['command']??null) &&
            hash_equals($row['fingerprint'],$command['fingerprint']??''),'OPERATION_ID_ALREADY_BOUND');
        return json_decode($row['result_json'],true,32,JSON_THROW_ON_ERROR);
    }
}
