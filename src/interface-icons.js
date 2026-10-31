// Local vector artwork: no font downloads, trackers or external icon runtime.
const paths={
 inicio:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
 pricing:'M3 3h8l10 10-8 8L3 11ZM7 7h.01',
 cajas:'M4 3h16v6H4zM3 13h18v8H3zM7 13v-4m10 4V9M7 17h.01M11 17h.01M15 17h3',
 gastos:'M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3',
 facturacion:'M4 3h12l4 4v14H4zM15 3v5h5M8 12h8M8 16h5',
 cotejos:'m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10M8 5l9 4',
 tareas:'M9 5h11M9 12h11M9 19h11M3 4l1 1 2-2M3 11l1 1 2-2M3 18l1 1 2-2',
 equipo:'M4 4h16v12H9l-5 4ZM8 8h8M8 12h5',
 documentos:'M3 6h7l2 2h9v12H3ZM3 8V4h7l2 2',
 fiscalidad:'m3 8 9-5 9 5ZM5 10v7m5-7v7m4-7v7m5-7v7M3 21h18M3 18h18',
 informes:'M4 3v18h17M8 16v-5m5 5V6m5 10v-8',
 administracion:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM9 12l2 2 4-4',
 configuracion:'M9 3h6l1 4 4 1v6l-4 2-1 5H9l-1-5-4-2V8l4-1ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 card:'M3 5h18v14H3ZM3 9h18M7 15h3',cash:'M3 6h18v12H3ZM7 6c0 3-1 4-4 4m14-4c0 3 1 4 4 4M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 records:'M4 4h16v16H4ZM4 9h16M9 9v11',draft:'M4 20h4L21 7l-4-4L4 16ZM14 6l4 4',warning:'m12 3 10 18H2ZM12 9v5M12 17h.01',
 plus:'M12 4v16M4 12h16',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6'
};
export function interfaceIcon(name){return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+(paths[name]||paths.records)+'"/></svg>';}
export function metricIcon(label){return /tarjeta/i.test(label)?'card':/metálico|efectivo|cobro/i.test(label)?'cash':/borrador|pendiente/i.test(label)?'draft':/descuadre|incidencia/i.test(label)?'warning':/gasto/i.test(label)?'gastos':/ingreso|venta|beneficio|resultado/i.test(label)?'informes':'records';}
