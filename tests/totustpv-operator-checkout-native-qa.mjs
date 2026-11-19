/** Complete original native adapter + real loopback SQL/HTTP flow; no remote shop. */
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tests/totustpv-native-http-qa.mjs','--operator-checkout-only'],{stdio:'inherit'});
