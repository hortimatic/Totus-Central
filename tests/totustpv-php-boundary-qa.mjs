import {execFileSync} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
const portable=path.resolve('artifacts/php82/php.exe');
const binary=process.env.TOTUS_PHP_BIN||(existsSync(portable)?portable:'php');
const options=binary===portable?['-n','-d',`extension_dir=${path.dirname(portable)}/ext`,'-d','extension=pdo_sqlite']:[];
function run(args){try{return execFileSync(binary,[...options,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
 catch(error){throw new Error(`PHP boundary check failed: ${error.stderr||error.stdout||error.message}`);}}
const version=run(['-r','echo PHP_VERSION;']);
process.stdout.write(run(['tests/totustpv-native-billing-qa.php']));
process.stdout.write(run(['tests/totustpv-native-receipt-variants-qa.php']));
process.stdout.write(run(['tests/totustpv-barcode-native-contract-qa.php']));
console.log(`Connector preparation checks on PHP ${version}; no installed PrestaShop runtime.`);
for(const file of readdirSync('connectors/prestashop/src').filter(file=>file.endsWith('.php')))
 run(['-l',`connectors/prestashop/src/${file}`]);
for(const file of readdirSync('connectors/prestashop/module').filter(file=>file.endsWith('.php')))
 run(['-l',`connectors/prestashop/module/${file}`]);
for(const file of readdirSync('connectors/prestashop/module/upgrade').filter(file=>file.endsWith('.php')))
 run(['-l',`connectors/prestashop/module/upgrade/${file}`]);
// Syntax only here: the native integration suite requires its real lab and is
// run explicitly, not silently substituted with fake native dependencies.
for(const file of readdirSync('tests/native-lab').filter(file=>file.endsWith('.php')))
 run(['-l',`tests/native-lab/${file}`]);
for(const file of ['tests/totustpv-document-logo-qa.php','tests/totustpv-catalogue-index-qa.php','tests/totustpv-return-order-qa.php','tests/totustpv-connector-qa.php','tests/totustpv-connector-journal-qa.php','tests/totustpv-native-effect-qa.php','tests/totustpv-native-quote-qa.php','tests/totustpv-native-cart-owner-qa.php','tests/totustpv-native-sale-note-qa.php','tests/totustpv-native-line-name-qa.php'])
 process.stdout.write(run([file]));
