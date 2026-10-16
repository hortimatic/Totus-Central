import {monthRange} from './utils.js';
const range=monthRange();
const dateFilter=()=>({from:range.from,to:range.to,store:'all',query:''});
export const state={
 session:null,user:null,route:'inicio',loading:false,
 views:{
   cajas:{mode:'list',id:null},
   gastos:{mode:'list',id:null},
   facturacion:{mode:'list',id:null,section:'documentos'},
   documentos:{mode:'list',id:null},
   pricing:{mode:'list',id:null},
   administracion:{section:'usuarios'}
 },
 filters:{
   pricing:{query:''},
   cajas:dateFilter(),
   gastos:dateFilter(),
   facturacion:dateFilter(),
   documentos:dateFilter(),
   fiscalidad:dateFilter(),
   informes:dateFilter()
 },
 data:{roles:[],rolePermissions:[],userPermissions:[],settings:null,storageUsage:{documents_bytes:0,documents_count:0,assets_bytes:0,assets_count:0,total_bytes:0,limit_bytes:500*1024*1024},team:[],profiles:[],stores:[],drawers:[],categories:[],suppliers:[],closings:[],closingDrawers:[],expenses:[],expenseLines:[],customers:[],series:[],invoices:[],invoiceLines:[],documents:[],taxPayments:[],reta:[],fiscalAdjustments:[],incomeAdjustments:[],audit:[],templates:[],brands:[],families:[],products:[],variants:[],providers:[],providerPrices:[],competitors:[],consultations:[]}
};
export const isAdmin=()=>state.user?.role==='admin';
export const isManager=()=>['admin','gerente'].includes(state.user?.role);
export const setRoute=id=>state.route=id;
export const getView=route=>state.views[route]||{mode:'list',id:null};
export const setView=(route,patch)=>Object.assign(state.views[route]||(state.views[route]={mode:'list',id:null}),patch);
export const resetView=route=>Object.assign(state.views[route]||(state.views[route]={}),{mode:'list',id:null});
export const getFilters=route=>state.filters[route]||{};
export const patchFilters=(route,patch)=>Object.assign(state.filters[route]||(state.filters[route]={}),patch);
export const resetData=()=>Object.keys(state.data).forEach(k=>state.data[k]=Array.isArray(state.data[k])?[]:null);
