<?php
require '/var/www/html/config/config.inc.php';
$module = Module::getInstanceByName('totusproductbridge');
if (!$module || !Module::isInstalled('totusproductbridge')) {
    throw new Exception('Bridge is not installed');
}
function verifyBridge($module, $script, $method, $price, $ratio, $before, $expected)
{
    $_SERVER['SCRIPT_FILENAME'] = $script;
    $_SERVER['REQUEST_METHOD'] = $method;
    $p = new Product();
    $p->price = $price;
    $p->unit_price_ratio = $ratio;
    $p->unit_price = $before;
    $module->hookActionObjectProductAddBefore(array('object' => $p));
    if (abs($p->unit_price - $expected) > 0.0000001 || $p->unit_price_ratio !== $ratio) {
        throw new Exception('Bridge guard or derived price failed');
    }
    $module->hookActionObjectProductUpdateBefore(array('object' => $p));
    if (abs($p->unit_price - $expected) > 0.0000001) {
        throw new Exception('Update hook failed');
    }
}
verifyBridge($module, '/var/www/html/webservice/dispatcher.php', 'POST', 12.314050, 2, 0, 6.157025);
verifyBridge($module, '/var/www/html/webservice/dispatcher.php', 'PUT', 20, 4, 3, 5);
verifyBridge($module, '/var/www/html/webservice/dispatcher.php', 'PUT', 20, 0, 3, 0);
verifyBridge($module, '/var/www/html/webservice/dispatcher.php', 'GET', 20, 4, 3, 3);
verifyBridge($module, '/var/www/html/admin-dev/index.php', 'POST', 20, 4, 0, 0);
verifyBridge($module, '/var/www/html/index.php', 'POST', 20, 4, 3, 3);
verifyBridge($module, '/var/www/html/modules/other/dispatcher.php', 'PUT', 20, 4, 3, 3);
echo "BRIDGE: native Webservice derives unit price; BO, GET and other scripts unchanged\n";

// Reproduce a shop with an installed but inactive language. Never in production.
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
echo "CI: installed inactive language " . $inactive->id . "\n";
