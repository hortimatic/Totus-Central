<?php
if(!defined('_PS_VERSION_'))exit;
// Printable snapshots live in the existing immutable command receipts.
// Keep storage and installation identity through the normal module upgrade.
function upgrade_module_0_2_1($module){return $module->ensureOwnStorage();}
