// Requires the existing local native laboratory. No remote shop is contacted.
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tests/totustpv-native-http-qa.mjs','--budget-only'],{stdio:'inherit'});
