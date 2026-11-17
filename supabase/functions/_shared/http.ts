import { createClient } from 'npm:@supabase/supabase-js@2';
export const cors = { 'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary':'Origin' };
export const json=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
export const service=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{db:{schema:'ifto_monitor'},auth:{persistSession:false}});
export function check<T extends {error: unknown}>(result:T):T {if(result.error) throw new Error('Operação indisponível');return result;}
