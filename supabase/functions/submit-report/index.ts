import { validateReport } from '../_shared/validate.ts';
import { service, json, cors, check } from '../_shared/http.ts';
Deno.serve(async request=>{
 if(request.method==='OPTIONS') return new Response(null,{headers:cors});
 if(request.method!=='POST') return json({error:'Método inválido'},405);
 try {
 const body=await request.json(),db=service(),bucket=db.storage.from('ifto-reports');
 const salt=Deno.env.get('IP_SALT');if(!salt) return json({error:'Serviço indisponível'},503);
 const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||request.headers.get('x-real-ip')||'unknown';
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip+salt)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 if(body.action==='create') {
 const report=validateReport(body);
 const rate=check(await db.rpc('consume_report_rate',{p_hash:hash}));if(!rate.data) return json({error:'Limite diário atingido. Tente amanhã.'},429);
 const now=new Date(),id=crypto.randomUUID();
 const linked=await db.from('trips').select('id').eq('bus_label',report.bus_label).lte('started_at',now.toISOString()).or(`ended_at.is.null,ended_at.gte.${new Date(now.getTime()-10800000).toISOString()}`).order('started_at',{ascending:false}).limit(1);
 const capability=crypto.randomUUID();
 check(await db.from('reports').insert({id,bus_label:report.bus_label,route_name:report.route_name||null,category:report.category,message:report.message||null,photo_count:report.photos.length,trip_id:linked.data?.[0]?.id||null,finalize_token:capability}));
 const uploads=[];
 for(const photo of report.photos) {
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.mime_type];
 const path=`${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,'0')}/${id}/${crypto.randomUUID()}.${ext}`;
 check(await db.from('report_photos').insert({report_id:id,storage_path:path,...photo,uploaded:false}));
 const signed=check(await bucket.createSignedUploadUrl(path));uploads.push({path,token:signed.data!.token});
 }
 return json({report_id:id,finalize_token:capability,uploads});
 }
 if(body.action==='finalize') {
 if(typeof body.report_id!=='string'||typeof body.finalize_token!=='string'||!Array.isArray(body.paths)||body.paths.length>2) return json({error:'Envio inválido'},400);
 const report=check(await db.from('reports').select('id,message,photo_count').eq('id',body.report_id).eq('finalize_token',body.finalize_token).maybeSingle());
 if(!report.data) return json({error:'Envio inválido'},403);
 const photos=check(await db.from('report_photos').select('*').eq('report_id',body.report_id));let count=0;
 for(const photo of photos.data||[]) {
 const slash=photo.storage_path.lastIndexOf('/'),folder=photo.storage_path.slice(0,slash),name=photo.storage_path.slice(slash+1);
 const files=check(await bucket.list(folder,{search:name}));const file=files.data?.find(f=>f.name===name);
 if(body.paths.includes(photo.storage_path)&&file&&Number(file.metadata?.size)>0&&Number(file.metadata?.size)<=1048576&&['image/jpeg','image/png','image/webp'].includes(file.metadata?.mimetype)) {check(await db.from('report_photos').update({uploaded:true}).eq('id',photo.id));count++;}
 else {check(await bucket.remove([photo.storage_path]));check(await db.from('report_photos').delete().eq('id',photo.id));}
 }
 if(!count&&!report.data.message) {check(await db.from('reports').delete().eq('id',body.report_id));return json({error:'Nenhuma foto recebida. Tente novamente.'},400);}
 check(await db.from('reports').update({photo_count:count}).eq('id',body.report_id));return json({report_id:body.report_id});
 }
 return json({error:'Ação inválida'},400);
 }catch(e){return json({error:e instanceof Error&&/inválid|Escreva|Fotos|Categoria|Texto/.test(e.message)?e.message:'Não foi possível enviar'},400);}
});
