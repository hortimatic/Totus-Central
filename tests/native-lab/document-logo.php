<?php
/** Public repository logo in the guarded disposable shop only. */
require __DIR__.'/bootstrap.php';
nativeLabCheck(copy($project.'/assets/branding/hortimatic.png',$nativeRoot.'/img/totus-qa-logo.png'),'Cannot prepare fixture logo');
nativeLabCheck(Configuration::updateValue('PS_SHOP_LOGO','totus-qa-logo.png',false,null,1),'Cannot select fixture logo');
