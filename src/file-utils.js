export const DOCUMENT_EXTENSIONS=['pdf','jpg','jpeg','png','webp','xlsx','xls','docx','csv','txt','md'];
export const DOCUMENT_MIME_TYPES=[
 'application/pdf','image/jpeg','image/png','image/webp',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'text/csv','text/plain','text/markdown'
];
export const DOCUMENT_ACCEPT=DOCUMENT_EXTENSIONS.map(x=>'.'+x).join(',');

export function fileExtension(name=''){
 const m=String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
 return m?m[1]:'';
}
export function previewKind(name='',mime=''){
 const ext=fileExtension(name),m=String(mime||'').toLowerCase();
 if(m.includes('pdf')||ext==='pdf')return 'pdf';
 if(m.startsWith('image/')||['jpg','jpeg','png','webp'].includes(ext))return 'image';
 if(['xlsx','xls'].includes(ext)||m.includes('spreadsheet')||m.includes('excel'))return 'excel';
 if(ext==='docx'||m.includes('wordprocessingml.document'))return 'docx';
 if(['csv','txt','md'].includes(ext)||m.startsWith('text/'))return 'text';
 return 'download';
}
export function validateDocumentFile(file,{maxBytes=20*1024*1024,usedBytes=0,limitBytes=500*1024*1024,replacingBytes=0}={}){
 if(!file)throw new Error('Selecciona un archivo.');
 const ext=fileExtension(file.name);
 if(!DOCUMENT_EXTENSIONS.includes(ext))throw new Error('Formato no permitido: .'+(ext||'?'));
 if(Number(file.size||0)<=0)throw new Error('El archivo está vacío.');
 if(Number(file.size||0)>Number(maxBytes))throw new Error('El archivo supera el máximo de '+Math.round(maxBytes/1024/1024)+' MB.');
 const projected=Math.max(0,Number(usedBytes||0)-Number(replacingBytes||0))+Number(file.size||0);
 if(projected>Number(limitBytes))throw new Error('No hay espacio suficiente en Storage.');
 return {extension:ext,kind:previewKind(file.name,file.type),projectedBytes:projected};
}
export function safeFileSegment(v){
 const segment=String(v||'sin_dato').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80);
 return segment && segment!=='.' && segment!=='..' ? segment : 'sin_dato';
}

/**
 * Asigna un nombre único dentro de un ZIP sin modificar el documento original.
 * Impide que facturas homónimas de un mismo proveedor sobrescriban otros archivos.
 * @param {{id?:string,doc_type?:string,supplier_or_customer?:string,original_name?:string}} doc
 * @param {Set<string>} occupied
 */
export function uniqueArchiveDocumentPath(doc,occupied=new Set()){
 const folder=safeFileSegment(doc.doc_type)+'/'+safeFileSegment(doc.supplier_or_customer||'Sin_parte');
 const name=safeFileSegment(doc.original_name||'documento');
 const extensionIndex=name.lastIndexOf('.');
 const ext=extensionIndex>0?name.slice(extensionIndex):'';
 const stem=extensionIndex>0?name.slice(0,extensionIndex):name;
 let path=folder+'/'+name;
 if(!occupied.has(path)){occupied.add(path);return path}
 const marker=safeFileSegment(String(doc.id||'copia')).slice(0,36);
 let index=1;
 do{path=folder+'/'+stem+'__'+marker+(index===1?'':'_'+index)+ext;index++}
 while(occupied.has(path));
 occupied.add(path);
 return path;
}
