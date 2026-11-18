<?php
// Compatibility entry point: the reviewed per-target workflow supersedes the
// discarded whole-batch rollback assumption. Never bypass native hooks.
require __DIR__.'/barcode-durable-provider.php';
