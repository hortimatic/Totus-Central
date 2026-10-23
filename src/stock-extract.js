// Extraction is local to the open browser; originals remain in the cloud.
// A page marker is never counted as readable document content.
export async function extractStockText(file,{pdfLibrary,xlsxLibrary}={}){
 const maxChars=250000,maxPages=100,parts=[],pages=[],warnings=[];
 let limited=false,total=0,read=0,format='';
 const append=text=>{const room=maxChars-total;if(text.length>room)limited=true;const value=text.slice(0,Math.max(0,room));parts.push(value);total+=value.length;};
 const name=String(file.name||'').toLowerCase();
 if(name.endsWith('.pdf')){
  format='pdf';
  const pdfjs=pdfLibrary||await import('./vendor/pdfjs/pdf.mjs');
  if(!pdfLibrary)pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  try{
   const pdf=await task.promise;total=0;
   if(pdf.numPages>maxPages){limited=true;warnings.push('El PDF supera las 100 páginas de lectura automática.');}
   for(let number=1;number<=Math.min(pdf.numPages,maxPages);number++){
    if(limited&&total>=maxChars)break;
    const page=await pdf.getPage(number),content=await page.getTextContent();
    let lastY=null,text='';
    for(const item of content.items){
     if(typeof item.str!=='string')continue;
     const y=item.transform?.[5];
     if(lastY!==null&&y!==undefined&&Math.abs(y-lastY)>2)text+='\n';
     else if(text&&!text.endsWith('\n'))text+=' ';
     text+=item.str;if(item.hasEOL)text+='\n';lastY=y;
    }
    text=text.trim();pages.push({page:number,readable:!!text,characters:text.length});
    if(text){read++;append('[Página '+number+']\n'+text+'\n');}
    else warnings.push('Página '+number+' sin texto: necesita lectura del original.');
    page.cleanup();
   }
   if(pages.length!==pdf.numPages)limited=true;
   return {text:parts.join('\n'),extraction:{state:read===0?'unread':limited||read!==pdf.numPages?'partial':'ready',format,pages,total_pages:pdf.numPages,warnings,reader:'pdfjs-text-v1'}};
  }finally{await task.destroy();}
 }
 if(/\.(xlsx|xls)$/.test(name)){
  format='excel';const xlsx=xlsxLibrary||globalThis.XLSX;
  if(!xlsx)throw new Error('No está disponible el lector de Excel.');
  const workbook=xlsx.read(await file.arrayBuffer(),{type:'array',cellDates:false,cellFormula:false,cellHTML:false});
  const names=workbook.SheetNames;if(names.length>50){limited=true;warnings.push('Se han leído las primeras 50 hojas.');}
  for(const sheetName of names.slice(0,50)){
   const rows=xlsx.utils.sheet_to_json(workbook.Sheets[sheetName],{header:1,raw:false,blankrows:true,defval:''});
   let readable=0;append('[Hoja '+sheetName+']\n');
   for(let i=0;i<Math.min(rows.length,5000);i++){
    const row=rows[i].map(v=>String(v)).join('\t');
    if(row.trim()){readable++;append('Fila '+(i+1)+'\t'+row+'\n');}
    if(total>=maxChars){limited=true;break;}
   }
   if(rows.length>5000)limited=true;
   pages.push({sheet:sheetName,rows:rows.length,readable_rows:readable});
   read+=readable;
   if(total>=maxChars)break;
  }
  return {text:read?parts.join('\n'):'',extraction:{state:read===0?'unread':limited?'partial':'ready',format,pages,warnings,reader:'xlsx-text-v1'}};
 }
 if(/\.(csv|txt|md)$/.test(name)){
  const raw=await file.text(),text=raw.slice(0,maxChars);limited=raw.length>maxChars;
  return {text,extraction:{state:!text.trim()?'unread':limited?'partial':'ready',format:'text',total_lines:raw.split(/\r?\n/).length,warnings:limited?['Texto truncado. Consulta el original.']:[],reader:'plain-text-v1'}};
 }
 return {text:'',extraction:{state:'unread',format:'image-or-unsupported',warnings:['Necesita lectura del original. No se ha aplicado OCR.'],reader:'original-required-v1'}};
}
