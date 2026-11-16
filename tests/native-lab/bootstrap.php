<?php
/** Dedicated, disposable native fixture. Never load a production installation. */
$project=realpath(__DIR__.'/../..');
$nativeRoot=realpath($project.'/artifacts/native-lab/shop');
if(!$nativeRoot || !str_starts_with(str_replace('\\','/',$nativeRoot),str_replace('\\','/',$project).'/artifacts/native-lab/')) {
    throw new RuntimeException('Native laboratory is not installed under this workspace.');
}
$parameters=require $nativeRoot.'/app/config/parameters.php';
$database=$parameters['parameters'];
if(($database['database_host']??'')!=='127.0.0.1' || (string)($database['database_port']??'')!=='3318' ||
   ($database['database_name']??'')!=='totus_tpv_lab' || ($database['database_user']??'')!=='tpv_lab') {
    throw new RuntimeException('Refusing to execute against a non-fixture database.');
}
unset($parameters,$database);
register_shutdown_function(static function(){
    $error=error_get_last();
    if($error&&in_array($error['type'],[E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR],true)) {
        fwrite(STDERR,'Native fixture error: '.substr(explode("\n",$error['message'])[0],0,500)."\n");
    }
});
$_SERVER['HTTP_HOST']='127.0.0.1:8771';$_SERVER['SERVER_NAME']='127.0.0.1';
$_SERVER['REQUEST_URI']='/';$_SERVER['REMOTE_ADDR']='127.0.0.1';
require $nativeRoot.'/config/config.inc.php';
if(_PS_VERSION_!=='8.2.8' || Db::getInstance()->getValue('SELECT DATABASE()')!=='totus_tpv_lab') {
    throw new RuntimeException('Unexpected native fixture version or schema.');
}
error_reporting(E_ALL & ~E_DEPRECATED & ~E_USER_DEPRECATED);
// No outgoing mail from any synthetic fixture, even when core hooks request it.
if(!Configuration::updateValue('PS_MAIL_METHOD',3))throw new RuntimeException('Cannot disable fixture email.');
$context=Context::getContext();
$context->shop=new Shop(1);
Shop::setContext(Shop::CONTEXT_SHOP,1);
$context->language=new Language((int)Configuration::get('PS_LANG_DEFAULT'));
$context->currency=new Currency((int)Configuration::get('PS_CURRENCY_DEFAULT'));
function nativeLabCheck(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
function nativeLabConnector(string $class): string {
    global $project,$nativeRoot;
    $source=$project.'/connectors/prestashop/src/'.$class.'.php';
    if(!Module::isInstalled('totuscentralconnector'))return $source;
    $installed=$nativeRoot.'/modules/totuscentralconnector/src/'.$class.'.php';
    nativeLabCheck(is_file($installed)&&hash_file('sha256',$source)===hash_file('sha256',$installed),'Installed fixture source is stale.');
    return $installed;
}
