<?php
// Disposable CI fixture data using PrestaShop's own language initialization.
require '/var/www/html/config/config.inc.php';
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
