import assert from 'node:assert/strict';
import {cleanupRange} from '../src/log-cleanup.js';
assert.deepEqual(cleanupRange('','2020-03-29','2026-10-29'),{p_from:null,p_to:'2020-03-29'});
assert.deepEqual(cleanupRange('2020-03-29','2020-10-25','2026-10-29'),{p_from:'2020-03-29',p_to:'2020-10-25'});
for(const [from,to] of [['',''],['2020-04-01','2020-03-29'],['2020-02-30','2020-03-29'],['','2027-01-01']])assert.throws(()=>cleanupRange(from,to,'2026-10-29'));
console.log('LOG CLEANUP: date ranges, whole-history cutoff, invalid and future dates verified');
