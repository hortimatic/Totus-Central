<?php
namespace TotusCentralConnector;

/** One durably claimed product/combination update. Some reviewed AFTER hooks
 * commit native SQL; this coordinator never pretends that a whole batch rolls
 * back, and reconciliation never calls Product::update again. */
final class NativeBarcodeEffect
{
    private \PDO $native;private PdoJournal $journal;private NativeBarcodeIntents $intents;private $inner;private $nativeHandle;
    public function __construct(\PDO $native,PdoJournal $journal,NativeBarcodeIntents $intents,$inner,callable $nativeHandle)
    {
        Protocol::ensure($nativeHandle()===$native&&!$native->inTransaction()&&$native->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql','BARCODE_NATIVE_PDO_REQUIRED');
        foreach(['validateCommand','execute','verify','reconcile'] as $method)Protocol::ensure(is_callable([$inner,$method]),'HANDLER_INVALID');
        $this->native=$native;$this->journal=$journal;$this->intents=$intents;$this->inner=$inner;$this->nativeHandle=$nativeHandle;
    }
    public function execute(array $command,array $dispatch): array
    {
        Protocol::ensure(is_string($dispatch['claim_token']??null),'DISPATCH_CLAIM_REQUIRED');
        $this->journal->assertClaim($command,$dispatch['claim_token']);
        $this->inner->validateCommand($command);
        $this->intents->record($command);
        Protocol::ensure(($this->nativeHandle)()===$this->native&&!$this->native->inTransaction(),'BARCODE_NATIVE_PDO_REQUIRED');
        // Cross-shop generated-code allocation shares one native namespace.
        $lock='totus:barcode:'.substr(hash('sha256',$command['installation_id']),0,40);
        $statement=$this->native->prepare('SELECT GET_LOCK(?,10)');$statement->execute([$lock]);
        Protocol::ensure((int)$statement->fetchColumn()===1,'BARCODE_GENERATOR_BUSY');
        try{
            $this->native->beginTransaction();
            try{
                $result=$this->inner->execute($command);
                Protocol::ensure(($this->nativeHandle)()===$this->native&&is_array($result)&&($result['verified']??false)===true,'BARCODE_READBACK_FAILED');
                if($this->native->inTransaction())$this->native->commit();
                return $this->inner->verify($result,$command);
            }catch(\Throwable $error){if($this->native->inTransaction())$this->native->rollBack();throw $error;}
        }finally{$statement=$this->native->prepare('SELECT RELEASE_LOCK(?)');$statement->execute([$lock]);}
    }
    public function reconcile(array $command,array $claim): ?array
    {
        Protocol::ensure(($this->nativeHandle)()===$this->native&&!$this->native->inTransaction(),'BARCODE_NATIVE_PDO_REQUIRED');
        $lock='totus:barcode:'.substr(hash('sha256',$command['installation_id']),0,40);
        $statement=$this->native->prepare('SELECT GET_LOCK(?,0)');$statement->execute([$lock]);
        if((int)$statement->fetchColumn()!==1)return null;
        try{return $this->inner->reconcile($command,$claim);}
        finally{$statement=$this->native->prepare('SELECT RELEASE_LOCK(?)');$statement->execute([$lock]);}
    }
}
