import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {withApplicationCors} from '../../../src/application-cors.js';
import {createCentralTpvHandler} from './handler.js';
if(import.meta.main)Deno.serve(withApplicationCors(createCentralTpvHandler({factory:createClient,env:Deno.env,
 onError:(error,context)=>console.error('totus-tpv',JSON.stringify({stage:context.stage,
  code:/^TPV_[A-Z0-9_]{1,90}$/.test(error?.message||'')?error.message:'TPV_UNEXPECTED_'+(error instanceof TypeError?'TYPE':error instanceof SyntaxError?'SYNTAX':'ERROR')}))})));
