import test from 'node:test';
import assert from 'node:assert/strict';
import {productGallery,moveProductPhoto,productGalleryDescription} from '../src/productos-gallery.js';
test('gallery draft orders only owned IDs and produces escaped native description without a private endpoint',()=>{
 const ids=['91','92'],draft={order:['92','999','92'],captions:{'92':'<script>foto & más','999':'foreign'}};
 assert.deepEqual(productGallery(ids,draft).order,['92','91']);assert.equal(productGallery(ids,draft).captions['999'],undefined);
 assert.deepEqual(moveProductPhoto(ids,draft,'91',1).order,['91','92']);assert.throws(()=>moveProductPhoto(ids,draft,'999',1),/no válida/);
 const html=productGalleryDescription('hortimatic',ids,draft,'Nombre');assert(html.indexOf('/92-')<html.indexOf('/91-'));assert(html.includes('&lt;script&gt;foto &amp; más'));assert(!html.includes('999'));assert(!html.includes('totus_product_images'));
});
