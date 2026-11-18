<?php
require __DIR__.'/bootstrap.php';
define('TOTUS_DISPOSABLE_NATIVE_LAB',true);
// Module installation in the native back office has a booted Symfony kernel.
// Reproduce that context here rather than altering native translation classes.
nativeLabKernel();
$module=Module::getInstanceByName('totuscentralconnector');
nativeLabCheck($module instanceof Totuscentralconnector,'Original package did not load in disposable lab.');
if(!Module::isInstalled('totuscentralconnector'))nativeLabCheck($module->install(),'Cannot install original package in disposable lab.');
nativeLabCheck($module->registerHook('actionEmailSendBefore'),'Cannot register scoped native-mail transaction boundary.');
nativeLabCheck($module->ensureOwnStorage(),'Cannot prepare original own-table schemas.');
$installation=Configuration::get('TOTUS_TPV_INSTALLATION_ID');
$journalCount=(int)Db::getInstance()->getValue('SELECT COUNT(*) FROM `'._DB_PREFIX_.'totus_tpv_journal`');
require_once $nativeRoot.'/modules/totuscentralconnector/upgrade/upgrade-0.2.1.php';
nativeLabCheck($module->version==='0.2.1'&&upgrade_module_0_2_1($module),'Cannot apply original additive native upgrade');
nativeLabCheck(Configuration::get('TOTUS_TPV_INSTALLATION_ID')===$installation&&(int)Db::getInstance()->getValue('SELECT COUNT(*) FROM `'._DB_PREFIX_.'totus_tpv_journal`')===$journalCount,'Upgrade reset installation identity or native journal');
// PHP's Windows development server has one worker. Serve PDF image assets from
// the test's separate loopback HTTP listener to avoid requesting that same busy
// worker recursively. This setting belongs only to the disposable database.
nativeLabCheck(Configuration::updateValue('PS_MEDIA_SERVER_1','127.0.0.1:8772'),'Cannot configure disposable image origin.');
echo "Original package installed in disposable loopback laboratory only.\n";
