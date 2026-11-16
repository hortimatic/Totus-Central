/** Explicit opt-in integration suite: requires the disposable native lab.
 * Missing PHP/PrestaShop/MariaDB is a failure, never a skipped success.
 * This does not install a module or contact a remote shop.
 */
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
const portable=path.resolve('artifacts/php82/php.exe');
const binary=process.env.TOTUS_PHP_BIN||(existsSync(portable)?portable:'php');
const ini=path.resolve('artifacts/native-lab/php.ini');
if(!existsSync(ini)||!existsSync('artifacts/native-lab/shop/app/config/parameters.php'))
 throw new Error('Native lab is not prepared. See tests/native-lab/README.md. No native test was executed.');
const env={...process.env};
if(binary===portable)env.OPENSSL_CONF=path.resolve('artifacts/php82/extras/ssl/openssl.cnf');
for(const file of ['journal.php','cart-quote.php','card-payment.php','card-finalize.php','mixed-refund.php','native-effect.php','owned-sales.php','document-customer.php']){
 try{process.stdout.write(execFileSync(binary,['-c',ini,`tests/native-lab/${file}`],
  {encoding:'utf8',env,maxBuffer:4*1024*1024,timeout:180000,stdio:['ignore','pipe','pipe']}));}
 catch(error){throw new Error(`Native integration failed at ${file}: ${error.stderr||error.stdout||error.message}`);}
}
console.log('PASS disposable local native integration suite. No remote shop, bank or Central deployment was exercised.');
