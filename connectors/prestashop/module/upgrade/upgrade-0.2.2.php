<?php
if(!defined('_PS_VERSION_'))exit;
// External references use existing immutable operation receipts; retain IDs.
function upgrade_module_0_2_2($module){return $module->ensureOwnStorage();}
