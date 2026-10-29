import {monthRange} from './utils.js';
const dateFilter=()=>({...monthRange(),store:'all',query:''});
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
   adminLog:{from:'',to:'',area:'',action:'',actor:'',query:''},
   pricing:{query:''},
   inicio:dateFilter(),
   cajas:dateFilter(),
   gastos:dateFilter(),
   facturacion:dateFilter(),
   documentos:dateFilter(),
   fiscalidad:dateFilter(),
   informes:dateFilter()
 },
 data:{activityLogError:'',auditError:'',auditUpdatedAt:null,auditLoading:false,backupConfig:null,backupRuns:[],recoveryJobs:[],roles:[],rolePermissions:[],userPermissions:[],settings:null,storageUsage:{status:'pending'},team:[],profiles:[],stores:[],drawers:[],categories:[],suppliers:[],closings:[],closingDrawers:[],expenses:[],expenseLines:[],customers:[],series:[],invoices:[],invoiceLines:[],documents:[],documentRemovals:[],taxPayments:[],fiscalAdjustments:[],incomeAdjustments:[],audit:[],templates:[],brands:[],families:[],products:[],variants:[],providers:[],providerPrices:[],competitors:[],consultations:[]}
};
export const isAdmin=()=>state.user?.role==='admin';
export const isManager=()=>['admin','gerente'].includes(state.user?.role);
export const setRoute=id=>state.route=id;
export const getView=route=>state.views[route]||{mode:'list',id:null};
export const setView=(route,patch)=>Object.assign(state.views[route]||(state.views[route]={mode:'list',id:null}),patch);
export const resetView=route=>Object.assign(state.views[route]||(state.views[route]={}),{mode:'list',id:null});
export const getFilters=route=>state.filters[route]||{};
export const patchFilters=(route,patch)=>Object.assign(state.filters[route]||(state.filters[route]={}),patch);
const initialData=structuredClone(state.data),initialViews=structuredClone(state.views),initialFilters=structuredClone(state.filters);
export const resetData=()=>{state.data=structuredClone(initialData)};
export function resetSessionData(){
 resetData();state.views=structuredClone(initialViews);state.filters=structuredClone(initialFilters);
 for(const [route,filter] of Object.entries(state.filters))if(Object.hasOwn(filter,'from')&&route!=='adminLog')state.filters[route]=dateFilter();
 state.route='inicio';state.loading=false;
}
