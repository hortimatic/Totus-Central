import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {withApplicationCors} from '../../../src/application-cors.js';
import {createCentralTpvHandler} from './handler.js';
if(import.meta.main)Deno.serve(withApplicationCors(createCentralTpvHandler({factory:createClient,env:Deno.env})));
