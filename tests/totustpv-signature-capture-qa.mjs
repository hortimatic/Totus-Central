import test from 'node:test';import assert from 'node:assert/strict';import {signatureInk,signatureSvg} from '../src/totustpv/signature-capture.js';
const ink={width:1000,height:400,strokes:[[[20,40],[60,80],[100,40]]]};
test('signature is bounded immutable ink and SVG cannot contain supplied markup',()=>{
 const clean=signatureInk(ink);clean.strokes[0][0][0]=300;assert.equal(ink.strokes[0][0][0],20);
 const svg=signatureSvg(ink);assert.match(svg,/M20 40 L60 80 L100 40/);assert.doesNotMatch(svg,/script|foreignObject|href|onload/);
 for(const invalid of [{...ink,width:999},{...ink,strokes:[]},{...ink,strokes:[[[1,1],[1,1]]]},{...ink,strokes:[[[1,1],['<script>',2]]]},{...ink,strokes:[[[1,1],[1001,2]]]},{...ink,strokes:[[[1,1],[3.5,2]]]},{...ink,html:'<script>'},{...ink,strokes:Array(129).fill(ink.strokes[0])}])assert.throws(()=>signatureInk(invalid));
});
