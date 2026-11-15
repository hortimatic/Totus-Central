<?php
namespace TotusCentralConnector;

/** Native-side execution coordinator. The repository must claim durably before
 * any handler effect. A process death never makes a pending claim reusable.
 * Handler reconciliation is read-only; it does not repeat the command.
 */
final class CommandRunner
{
    private $repository;
    private array $handlers;

    public function __construct($repository, array $handlers)
    {
        foreach (['claim', 'complete', 'uncertain'] as $method) {
            Protocol::ensure(is_callable([$repository, $method]), 'DURABLE_REPOSITORY_REQUIRED');
        }
        $this->repository = $repository;
        $this->handlers = $handlers;
    }

    public function execute(array $command): array
    {
        Protocol::ensure(isset($this->handlers[$command['command']]), 'COMMAND_NOT_IMPLEMENTED');
        $handler = $this->handlers[$command['command']];
        Protocol::ensure(is_callable([$handler, 'execute']) && is_callable([$handler, 'reconcile']), 'HANDLER_INVALID');
        $claim = $this->repository->claim($command);
        if (($claim['won'] ?? false) !== true) {
            return $this->existing($command, $handler, $claim);
        }
        Protocol::ensure(is_string($claim['token'] ?? null) && strlen($claim['token']) >= 16, 'CLAIM_INVALID');
        $token = $claim['token'];
        $result = null;
        try {
            // Internal context, never an accepted JSON field or browser flag.
            $result = $handler->execute($command,['claim_token'=>$token]);
            Protocol::ensure(is_array($result) && ($result['verified'] ?? false) === true, 'READBACK_REQUIRED');
            return $this->repository->complete($command, $token, $result);
        } catch (\Throwable $error) {
            // Diagnostics contain class and stable code, never raw exception
            // messages, customer data, SQL, credentials or a full stack trace.
            $reason = preg_match('/^TOTUS_[A-Z0-9_]{1,90}$/D', $error->getMessage())
                ? $error->getMessage() : 'TOTUS_NATIVE_EXECUTION_FAILED';
            $nativeReference = is_array($result) ? ($result['native_reference'] ?? null) : null;
            try {
                return $this->repository->uncertain($command, $token, [
                    'reason' => $reason,
                    'error_class' => get_class($error),
                    'native_reference' => $nativeReference,
                ]);
            } catch (\Throwable $storageError) {
                return ['status' => 'uncertain', 'operation_id' => $command['operation_id'],
                    'retry_command_forbidden' => true, 'native_reference' => $nativeReference,
                    'reason' => 'TOTUS_JOURNAL_UNAVAILABLE'];
            }
        }
    }

    private function existing(array $command, $handler, array $claim): array
    {
        Protocol::ensure(($claim['same_intent'] ?? false) === true, 'OPERATION_ID_ALREADY_BOUND');
        if (($claim['status'] ?? '') === 'completed') {
            return $claim['result'];
        }
        // Read-only recovery may recognize an effect after a lost response.
        // It cannot authorize execution again merely because a lease expired.
        try {
            $observed = $handler->reconcile($command, $claim);
            if (is_array($observed) && ($observed['verified'] ?? false) === true) {
                return $this->repository->complete($command, null, $observed);
            }
        } catch (\Throwable $error) {
            return ['status'=>'uncertain','operation_id'=>$command['operation_id'],
                'retry_command_forbidden'=>true,'reason'=>'TOTUS_RECONCILIATION_UNAVAILABLE'];
        }
        return ['status' => 'uncertain', 'operation_id' => $command['operation_id'],
            'retry_command_forbidden' => true, 'reason' => 'TOTUS_NATIVE_RESULT_NOT_OBSERVED'];
    }
}
