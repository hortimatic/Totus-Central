<?php
// Disposable CI fixture data using PrestaShop's own language initialization.
require '/var/www/html/config/config.inc.php';
// This disposable image omits HTMLPurifier's writable cache directory.
// Set up its normal runtime precondition before sending complete product XML.
$purifierCache = _PS_CACHE_DIR_ . 'purifier';
if (!is_dir($purifierCache) && !mkdir($purifierCache, 0775, true)) {
    throw new Exception('Could not initialize isolated purifier cache');
}
if (!chown($purifierCache, 'www-data') || !chgrp($purifierCache, 'www-data')) {
    throw new Exception('Could not assign isolated purifier cache');
}
$inactive = new Language();
$inactive->name = 'CI inactive language';
$inactive->iso_code = 'zz';
$inactive->language_code = 'zz-ZZ';
$inactive->locale = 'zz-ZZ';
$inactive->active = 0;
$inactive->is_rtl = 0;
$inactive->date_format_lite = 'Y-m-d';
$inactive->date_format_full = 'Y-m-d H:i:s';
if (!$inactive->add()) { throw new Exception('Could not create isolated inactive language'); }
echo "CI installed inactive language: " . $inactive->id . "\n";
