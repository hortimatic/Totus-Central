-- Storage configuration aligned with the files accepted by the UI.
update storage.buckets
set allowed_mime_types=array[
 'application/pdf','image/jpeg','image/png','image/webp',
 'text/csv','text/plain','text/markdown',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'application/vnd.ms-excel'
 ,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id='business-documents';
