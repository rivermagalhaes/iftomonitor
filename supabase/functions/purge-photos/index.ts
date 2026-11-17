import { createClient } from 'npm:@supabase/supabase-js@2';
import {service,json,cors,check} from '../_shared/http.ts';
Deno.serve(async request=>{
 if(request.method==='OPTIONS') return new Response(null,{headers:cors});
 if(request.method!=='POST') return json({error:'Método inválido'},405);
 try {
 const authorization=request.headers.get('Authorization');if(!authorization) return json({error:'Sem permissão'},401);
 const caller=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{db:{schema:'ifto_monitor'},global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
 const user=await caller.auth.getUser();const admin=await caller.rpc('is_admin');if(user.error||!user.data.user||admin.error||admin.data!==true)return json({error:'Sem permissão'},403);
 const body=await request.json(),days=body.days??90;if(!Number.isInteger(days)||days<1||days>3650)return json({error:'Dias inválidos'},400);
 const db=service();let count=0;const cutoff=new Date(Date.now()-days*86400000).toISOString();
 while(true){const photos=check(await db.from('report_photos').select('*').eq('keep',false).lt('created_at',cutoff).limit(100));if(!photos.data?.length)break;
 for(const p of photos.data){check(await db.storage.from('ifto-reports').remove([p.storage_path]));check(await db.from('report_photos').delete().eq('id',p.id).eq('keep',false));const remaining=check(await db.from('report_photos').select('id',{count:'exact',head:true}).eq('report_id',p.report_id).eq('uploaded',true));const report=check(await db.from('reports').select('message').eq('id',p.report_id).single());check(await db.from('reports').update({photo_count:remaining.count||0,...(!remaining.count&&!report.data?.message?{message:'[Fotos removidas pela política de retenção]'}:{})}).eq('id',p.report_id));count++;}}
 return json({count});
 }catch{return json({error:'Não foi possível limpar fotos'},500);}
});
