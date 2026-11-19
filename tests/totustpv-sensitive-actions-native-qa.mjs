import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['tests/totustpv-native-http-qa.mjs','--sensitive-actions-only'],{stdio:'inherit'});
