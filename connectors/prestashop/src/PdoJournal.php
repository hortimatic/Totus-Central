<?php
namespace TotusCentralConnector;

/** Journal for the connector's OWN table, never direct writes to native orders.
 * Use an independent PDO connection in autocommit so the dispatch claim survives
 * an unrelated rollback in a native handler. No automatic retry of effects.
 */
final class PdoJournal
{
    private \PDO $db;
    private string $table;
    private string $installationId;

    public function __construct(\PDO $db, string $table, string $installationId)
    {
        Protocol::ensure(preg_match('/^[a-zA-Z0-9_]{1,64}$/D', $table) === 1 && Protocol::uuid($installationId), 'JOURNAL_CONFIG_INVALID');
        Protocol::ensure(!$db->inTransaction(), 'JOURNAL_REQUIRES_AUTOCOMMIT');
        $db->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $this->db = $db;
        $this->table = '`' . $table . '`';
        $this->installationId = $installationId;
    }

    public function claim(array $command): array
    {
        $this->validate($command);
        Protocol::ensure(!$this->db->inTransaction(), 'JOURNAL_REQUIRES_AUTOCOMMIT');
        $token = bin2hex(random_bytes(32));
        try {
            $statement = $this->db->prepare('INSERT INTO ' . $this->table . '
                (request_id,installation_id,api_account_id,shop_id,actor_id,command,fingerprint,status,claim_token)
                VALUES (:request,:installation,:account,:shop,:actor,:command,:hash,\'pending\',:token)');
            $statement->execute(['request'=>$command['operation_id'],'installation'=>$this->installationId,
                'account'=>$command['api_account_id'],'shop'=>$command['shop_id'],'actor'=>$command['actor_id'],
                'command'=>$command['command'],'hash'=>$command['fingerprint'],'token'=>$token]);
        } catch (\PDOException $error) {
            // A duplicate may be an existing operation. Every other failure
            // prevents dispatch; never convert a storage failure to "not found".
            if ($error->getCode() !== '23000' && $error->getCode() !== '23505') {
                throw new \RuntimeException('TOTUS_JOURNAL_UNAVAILABLE');
            }
        }
        $row = $this->find($command['operation_id']);
        Protocol::ensure($row !== null, 'CLAIM_NOT_PERSISTED');
        if ($row['claim_token'] === $token && $row['status'] === 'pending') {
            return ['won'=>true,'token'=>$token];
        }
        return $this->existing($row, $command);
    }

    /** A native effect requires the already committed winning dispatch claim. */
    public function assertClaim(array $command,string $token): void
    {
        $this->validate($command);
        Protocol::ensure(!$this->db->inTransaction(),'JOURNAL_REQUIRES_AUTOCOMMIT');
        $row=$this->find($command['operation_id']);
        Protocol::ensure($row!==null && $this->sameIntent($row,$command) &&
            $row['status']==='pending' && hash_equals($row['claim_token'],$token),'DISPATCH_CLAIM_REQUIRED');
    }

    public function complete(array $command, ?string $token, array $result): array
    {
        $this->validate($command);
        Protocol::ensure(($result['verified'] ?? false) === true, 'READBACK_REQUIRED');
        $row = $this->find($command['operation_id']);
        Protocol::ensure($row !== null && $this->sameIntent($row, $command), 'OPERATION_ID_ALREADY_BOUND');
        $reference = $this->reference($result['native_reference'] ?? null);
        Protocol::ensure($row['native_reference'] === null || $row['native_reference'] === $reference, 'NATIVE_REFERENCE_MISMATCH');
        if ($row['status'] === 'completed') {
            return json_decode($row['result_json'], true, 32, JSON_THROW_ON_ERROR);
        }
        Protocol::ensure($token === null || hash_equals($row['claim_token'], $token), 'CLAIM_MISMATCH');
        $serialized = Protocol::canonical($result);
        Protocol::ensure(strlen($serialized) <= Protocol::MAX_BODY_BYTES, 'RESULT_TOO_LARGE');
        $nativeOrder = null;
        if ($command['command'] === 'sale.commit') {
            Protocol::ensure(is_int($result['native_reference'] ?? null) && $result['native_reference'] > 0, 'ORDER_ID_REQUIRED');
            $nativeOrder = $result['native_reference'];
        }
        $statement = $this->db->prepare('UPDATE ' . $this->table . ' SET status=\'completed\',
            native_reference=:reference,native_order_id=:native_order,result_json=:result,error_code=NULL,
            updated_at=CURRENT_TIMESTAMP WHERE request_id=:request AND fingerprint=:hash
            AND status IN (\'pending\',\'uncertain\') AND (native_reference IS NULL OR native_reference=:same_reference)');
        $statement->execute(['reference'=>$reference,'same_reference'=>$reference,'native_order'=>$nativeOrder,
            'result'=>$serialized,'request'=>$command['operation_id'],'hash'=>$command['fingerprint']]);
        $current = $this->find($command['operation_id']);
        Protocol::ensure($current !== null && $current['status'] === 'completed' &&
            $current['native_reference'] === $reference, 'COMPLETION_NOT_PERSISTED');
        return json_decode($current['result_json'], true, 32, JSON_THROW_ON_ERROR);
    }

    public function uncertain(array $command, string $token, array $diagnostic): array
    {
        $this->validate($command);
        $row = $this->find($command['operation_id']);
        Protocol::ensure($row !== null && $this->sameIntent($row, $command) && hash_equals($row['claim_token'], $token), 'CLAIM_MISMATCH');
        if ($row['status'] === 'completed') {
            return json_decode($row['result_json'], true, 32, JSON_THROW_ON_ERROR);
        }
        Protocol::ensure(is_string($diagnostic['reason'] ?? null) &&
            preg_match('/^TOTUS_[A-Z0-9_]{1,90}$/D', $diagnostic['reason']) === 1, 'DIAGNOSTIC_INVALID');
        $reference = $this->reference($diagnostic['native_reference'] ?? null);
        Protocol::ensure($reference === null || $row['native_reference'] === null || $row['native_reference'] === $reference,
            'NATIVE_REFERENCE_MISMATCH');
        $statement = $this->db->prepare('UPDATE ' . $this->table . ' SET status=\'uncertain\',
            native_reference=COALESCE(native_reference,:reference),error_code=:reason,updated_at=CURRENT_TIMESTAMP
            WHERE request_id=:request AND claim_token=:token AND status IN (\'pending\',\'uncertain\')');
        $statement->execute(['reference'=>$reference,'reason'=>$diagnostic['reason'],
            'request'=>$command['operation_id'],'token'=>$token]);
        $current = $this->find($command['operation_id']);
        if ($current['status'] === 'completed') {
            return json_decode($current['result_json'], true, 32, JSON_THROW_ON_ERROR);
        }
        return ['status'=>'uncertain','operation_id'=>$command['operation_id'],'retry_command_forbidden'=>true,
            'native_reference'=>$current['native_reference'],'reason'=>$diagnostic['reason']];
    }

    private function find(string $id): ?array
    {
        $statement = $this->db->prepare('SELECT * FROM ' . $this->table . ' WHERE request_id=:id');
        $statement->execute(['id'=>$id]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    private function existing(array $row, array $command): array
    {
        if (!$this->sameIntent($row, $command)) {
            return ['won'=>false,'same_intent'=>false];
        }
        return ['won'=>false,'same_intent'=>true,'status'=>$row['status'],
            'native_reference'=>$row['native_reference'],
            'result'=>$row['result_json'] === null ? null : json_decode($row['result_json'], true, 32, JSON_THROW_ON_ERROR)];
    }

    private function sameIntent(array $row, array $command): bool
    {
        return $row['installation_id'] === $this->installationId && (int)$row['api_account_id'] === $command['api_account_id'] &&
            (int)$row['shop_id'] === $command['shop_id'] && $row['actor_id'] === $command['actor_id'] && $row['command'] === $command['command'] &&
            hash_equals($row['fingerprint'], $command['fingerprint']);
    }

    private function validate(array $command): void
    {
        Protocol::ensure(Protocol::uuid($command['operation_id'] ?? null) &&
            Protocol::uuid($command['actor_id'] ?? null) &&
            ($command['installation_id'] ?? null) === $this->installationId &&
            is_int($command['api_account_id'] ?? null) && $command['api_account_id'] > 0 &&
            is_int($command['shop_id'] ?? null) && $command['shop_id'] > 0 &&
            is_string($command['fingerprint'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $command['fingerprint']) === 1,
            'JOURNAL_COMMAND_INVALID');
    }

    private function reference($value): ?string
    {
        if ($value === null) {
            return null;
        }
        Protocol::ensure((is_int($value) || is_string($value)) &&
            preg_match('/^[a-zA-Z0-9_.:-]{1,100}$/D', (string)$value) === 1, 'NATIVE_REFERENCE_INVALID');
        return (string)$value;
    }
}
