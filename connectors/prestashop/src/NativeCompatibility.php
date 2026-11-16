<?php
namespace TotusCentralConnector;

/** PS 8.2.8's Webservice handler treats PHP 8.2 vendor deprecations as business
 * failures. Scope the compatibility boundary to this authenticated request,
 * log those notices, and forward every real warning/error and own diagnostic.
 * No core file, global PHP setting or validation rule changes.
 */
final class NativeCompatibility
{
    public static function enter(): callable
    {
        $previous=null;$logged=[];$root=str_replace('\\','/',_PS_ROOT_DIR_).'/';
        $previous=set_error_handler(static function($level,$message,$file,$line)use(&$previous,&$logged,$root){
            $source=str_replace('\\','/',$file);
            $native=str_starts_with($source,$root.'classes/')||str_starts_with($source,$root.'vendor/')||str_starts_with($source,$root.'src/');
            if(in_array($level,[E_DEPRECATED,E_USER_DEPRECATED],true)&&$native){
                $key=hash('sha256',$message.$file.$line);if(!isset($logged[$key])){error_log('Totus native compatibility: '.$message.' in '.$file.':'.$line);$logged[$key]=true;}return true;
            }
            return is_callable($previous)?$previous($level,$message,$file,$line):false;
        });
        return static function(){restore_error_handler();};
    }
}
