<?php
namespace TotusCentralConnector;

/** Compose durable dispatch, native SQL transaction and fresh business readback.
 * Inner handlers must use native APIs, verify all required effects, and keep
 * reconciliation strictly read-only, returning the same immutable verified
 * result. Volatile timestamps/global stock snapshots do not belong in receipts.
 * This is not an HTTP authentication layer.
 */
final class NativeEffectHandler
{
    private PdoNativeEffect $effects;
    private $inner;
    public function __construct(PdoNativeEffect $effects,$inner)
    {
        Protocol::ensure(is_callable([$inner,'execute'])&&is_callable([$inner,'reconcile']),'HANDLER_INVALID');
        $this->effects=$effects;$this->inner=$inner;
    }
    public function execute(array $command,array $dispatch): array
    {
        Protocol::ensure(is_string($dispatch['claim_token']??null),'DISPATCH_CLAIM_REQUIRED');
        return $this->effects->run($command,$dispatch['claim_token'],fn()=>$this->inner->execute($command));
    }
    public function reconcile(array $command,array $claim): ?array
    {
        $receipt=$this->effects->receipt($command);
        if($receipt===null)return null;
        $observed=$this->inner->reconcile($command,$claim);
        Protocol::ensure(is_array($observed)&&($observed['verified']??false)===true&&
            ($observed['native_reference']??null)!==null&&
            $observed['native_reference']===($receipt['native_reference']??null) &&
            Protocol::canonical($observed)===Protocol::canonical($receipt),'NATIVE_RECEIPT_READBACK_MISMATCH');
        return $observed;
    }
}
