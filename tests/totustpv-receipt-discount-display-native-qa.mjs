/** Original connector, native order history and SQL preferences; loopback only. */
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tests/totustpv-native-http-qa.mjs','--receipt-discount-display-only'],{stdio:'inherit'});
