import {monthRange} from './utils.js';
const range=monthRange();
export const state={
 session:null,user:null,route:'inicio',loading:false,
 filters:{from:range.from,to:range.to,store:'all',query:''},
 data:{settings:null,team:[],profiles:[],stores:[],drawers:[],categories:[],suppliers:[],closings:[],closingDrawers:[],expenses:[],expenseLines:[],customers:[],series:[],invoices:[],invoiceLines:[],documents:[],taxPayments:[],reta:[],fiscalAdjustments:[],incomeAdjustments:[],audit:[],templates:[],brands:[],families:[],products:[],variants:[],providers:[],providerPrices:[],competitors:[],consultations:[]}
};
export const isAdmin=()=>state.user?.role==='admin';
export const isManager=()=>['admin','gerente'].includes(state.user?.role);
export const setRoute=id=>state.route=id;
export const patchFilters=p=>Object.assign(state.filters,p);
export const resetData=()=>Object.keys(state.data).forEach(k=>state.data[k]=Array.isArray(state.data[k])?[]:null);
