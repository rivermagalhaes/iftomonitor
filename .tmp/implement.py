from pathlib import Path
def write(p,s):
 Path(p).parent.mkdir(parents=True,exist_ok=True); Path(p).write_text(s,encoding='utf-8')
def edit(p,a,b):
 s=Path(p).read_text(encoding='utf-8'); assert a in s,(p,a); write(p,s.replace(a,b))
write('docs/NUVEM_E_RELATOS.md','''# Nuvem e relatos — 2.0.0

## Diagnóstico e mapeamento
O banco local mantém vehicles, routes, trips, gps_points, stops e app_meta. Eventos são objetos em trips.events. Nada é removido no envio.

| Local | Nuvem ifto_monitor |
|---|---|
| vehicles.label / trips.bus_label | trips.bus_label (snapshot) |
| routes.name / trips.route_name | trips.route_name; trigger resolve route_id remoto |
| trips.id, device_id, app_version, started_at, ended_at, status | mesmas colunas; horários ISO UTC |
| análise dos pontos | distance_m, duration_s, points_count, stops_count, gap_count, gap_total_s |
| demais campos da viagem e metadados locais dos pontos/paradas | trips.extra |
| gps_points | trip_points: trip_id, seq, recorded_at, latitude, longitude, accuracy_m, speed_mps, accepted, source, gap_before_s, suspect |
| stops | trip_stops: id, trip_id, arrived_at, departed_at, duration_s, latitude, longitude, status, label, detected_by |
| trips.events: type, at, details | trip_events: event_type, occurred_at, detail; app_version |

As migrações antigas 0001_init.sql e 0002_stop_manual_confirmation.sql usam public e pertencem ao fluxo antigo. Não as aplicar no projeto novo. O cliente novo usa exclusivamente ifto_monitor. IDs locais de rotas não são IDs remotos.
''')
edit('src/data/models.ts','export interface SyncFields {','export interface SyncFields {\n    synced_at?: string | null;')
edit('src/data/models.ts','export interface TripEvent {','export interface TripEvent {\n    synced_at?: string | null;')
edit('src/data/models.ts',"{ sync_status: 'pending', sync_attempts", "{ synced_at: null, sync_status: 'pending', sync_attempts")
edit('src/data/indexeddb/index.ts','openDB(name, 3,','openDB(name, 4,')
edit('src/data/indexeddb/index.ts',"const cursor = tx.objectStore('trips').openCursor();", "for (const table of ['gps_points', 'stops'] as const) {\n            void tx.objectStore(table).openCursor().then(async function migrate(row): Promise<void> { if (!row) return; await row.update({ ...row.value, synced_at: row.value.synced_at ?? null }); return migrate(await row.continue()); });\n        }\n        const cursor = tx.objectStore('trips').openCursor();")
edit('src/data/indexeddb/index.ts',"...row.value, bus_label:","...row.value, synced_at: row.value.synced_at ?? null, sync_status: row.value.synced_at ? 'synced' : 'pending', events: (row.value.events || []).map((e: object) => ({ ...e, synced_at: null })), bus_label:")
edit('src/services/auth.ts',"{ auth: { flowType:","{ db: { schema: 'ifto_monitor' }, auth: { flowType:")
write('.env.example','VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=\n')
write('src/services/cloudSync.ts','''import { createClient } from '@supabase/supabase-js';
import type { Repository } from '../data/repository';
import type { Trip, GpsPoint, Stop } from '../data/models';
import { analyzeTrack } from '../lib/geo';
import { backoff } from '../sync/sync';
export type CloudRow = Record<string, unknown>;
export interface CloudWriter { insert(table: string, rows: CloudRow[]): Promise<{ error: { code?: string; message?: string; status?: number } | null; status?: number }> }
export const duplicate = (error: {code?: string; status?: number}, status?: number) => error.code === '23505' || error.status === 409 || status === 409;
// Split duplicates too: a conflicting row must never hide new rows in the same transaction.
export async function insertSafe(writer: CloudWriter, table: string, rows: CloudRow[]): Promise<void> {
 if (!rows.length) return;
 const result = await writer.insert(table, rows);
 if (!result.error) return;
 if (rows.length === 1) { if (duplicate(result.error, result.status)) return; throw new Error(result.error.message || 'Erro ao enviar'); }
 const middle = Math.ceil(rows.length / 2); const errors: unknown[] = [];
 for (const half of [rows.slice(0,middle), rows.slice(middle)]) { try { await insertSafe(writer,table,half); } catch(e) { errors.push(e); } }
 if (errors.length) throw errors[0];
}
export function cloudPayload(trip: Trip, points: GpsPoint[], stops: Stop[]) {
 const track = analyzeTrack(points,trip.gps_interval_ms);
 const pick = (row: object, keys: string[]) => Object.fromEntries(keys.map(k=>[k,(row as CloudRow)[k] ?? null]));
 return {
 trips: [{...pick(trip,['id','device_id','app_version','status']), bus_label: trip.bus_label || trip.vehicle_label_snapshot, route_name: trip.route_name || null, started_at: new Date(trip.started_at).toISOString(), ended_at: new Date(trip.ended_at!).toISOString(), distance_m: track.distance, duration_s: Math.round((Date.parse(trip.ended_at!)-Date.parse(trip.started_at))/1000), points_count: points.length, stops_count: stops.filter(s=>s.status!=='descartada').length, gap_count: track.gaps.length, gap_total_s: track.gapSeconds, extra: {local:trip, point_metadata:points.map(p=>pick(p,['id','received_at','device_id'])), stop_metadata:stops.map(s=>pick(s,['id','avg_accuracy_m','manually_confirmed','created_at','updated_at']))}}],
 trip_points: points.map(p=>({...pick(track.annotated.get(p.id)||p,['trip_id','seq','latitude','longitude','accuracy_m','speed_mps','accepted','source','gap_before_s','suspect']),recorded_at:new Date(p.recorded_at).toISOString()})),
 trip_stops: stops.map(s=>({...pick(s,['id','trip_id','latitude','longitude','status','label','detected_by']),duration_s:Math.round(s.duration_s),arrived_at:new Date(s.arrived_at).toISOString(),departed_at:s.departed_at?new Date(s.departed_at).toISOString():null})),
 trip_events: (trip.events||[]).map(e=>({trip_id:trip.id,event_type:e.type,occurred_at:new Date(e.at).toISOString(),detail:e.details,app_version:trip.app_version})) };
}
const locks = new WeakSet<Repository>();
export function cloudWriter(): CloudWriter | null {
 const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
 if (!url || !key) return null;
 const client=createClient(url,key,{db:{schema:'ifto_monitor'},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 return {async insert(table,rows){const {error,status}=await client.from(table).insert(rows);return {error,status};}};
}
export async function syncCloud(repo: Repository, writer: CloudWriter | null, allowed: ()=>boolean, manual=false, now=Date.now) {
 if (!writer || locks.has(repo) || !allowed() || repo.name.includes('demo')) return;
 locks.add(repo);
 try { for (const trip of await repo.all('trips')) {
 if (!allowed()) break;
 if (trip.status!=='finished' || trip.synced_at || (!manual && trip.next_retry_at && Date.parse(trip.next_retry_at)>now())) continue;
 const points=(await repo.all('gps_points')).filter(p=>p.trip_id===trip.id), stops=(await repo.all('stops')).filter(s=>s.trip_id===trip.id);
 try {
 const payload=cloudPayload(trip,points,stops);
 for (const table of ['trips','trip_points','trip_stops','trip_events'] as const) { const rows=payload[table]; for(let i=0;i<rows.length;i+=500) {if(!allowed()) throw new Error('Envio interrompido'); await insertSafe(writer,table,rows.slice(i,i+500));} }
 const stamp=new Date(now()).toISOString();
 for (const p of points) await repo.put('gps_points',{...p,synced_at:stamp,sync_status:'synced',last_error:null});
 for (const s of stops) await repo.put('stops',{...s,synced_at:stamp,sync_status:'synced',last_error:null});
 const current=await repo.get('trips',trip.id);
 if (current && current.updated_at===trip.updated_at) await repo.put('trips',{...current,synced_at:stamp,sync_status:'synced',last_error:null,next_retry_at:null,events:(current.events||[]).map(e=>({...e,synced_at:stamp}))});
 await repo.put('app_meta',{key:'last_cloud_sync',value:stamp});
 } catch(e) { const current=await repo.get('trips',trip.id); if(current) {const attempts=current.sync_attempts+1;await repo.put('trips',{...current,sync_status:'error',sync_attempts:attempts,last_error:e instanceof Error?e.message:String(e),next_retry_at:new Date(now()+backoff(attempts)).toISOString()});} }
 } } finally {locks.delete(repo);}
}
''')
p=Path('src/services/monitor.ts');s=p.read_text(encoding='utf-8');s=s.replace("import { SyncService } from '../sync/sync';","import { cloudWriter, syncCloud } from './cloudSync';").replace("import { supabaseSyncClient } from '../sync/supabase';",'');start=s.index('    async sync(manual = false)');end=s.index('    setOnline(',start)
s=s[:start]+'''    get cloudEnabled() { return localStorage.getItem('ifto_cloud_enabled') !== '0'; }
    get lastCloudSync() { return this.snapshot.trips.map(t=>t.synced_at||'').sort().at(-1)||''; }
    async setCloudEnabled(enabled: boolean) { localStorage.setItem('ifto_cloud_enabled',enabled?'1':'0'); await this.refresh(); if(enabled) void this.sync(); }
    async sync(manual = false) {
        if (!this.repository) return;
        await syncCloud(this.repository,cloudWriter(),()=>this.cloudEnabled && this.snapshot.online && this.snapshot.mode!=='demo' && !this.service?.active,manual);
        await this.refresh();
        if(this.syncTimer) clearTimeout(this.syncTimer);
        const retries=this.snapshot.trips.filter(t=>!t.synced_at && t.next_retry_at).map(t=>Date.parse(t.next_retry_at!));
        if(retries.length && this.cloudEnabled && this.snapshot.online && !this.service?.active) this.syncTimer=setTimeout(()=>{void this.sync();},Math.max(5000,Math.min(...retries)-Date.now()));
    }
'''+s[end:];write(str(p),s)
edit('src/screens/Screens.tsx',"{!isSupabaseConfigured() && s.mode !== 'demo' ? t.cloudMissing : t.sync}","{!isSupabaseConfigured() && s.mode !== 'demo' ? t.cloudMissing : 'Sincronizar agora'}")
edit('src/screens/Screens.tsx',"<button className=\"link full\" onClick={() => navigate('/history')}","<p role=\"status\">{!isSupabaseConfigured() ? t.cloudMissing : !m.cloudEnabled ? 'Nuvem desligada' : !s.online ? 'Sem internet' : s.trips.some(t=>t.sync_status==='error' && !t.synced_at) ? 'Erro ao enviar (tentar de novo)' : s.trips.some(t=>t.status==='finished' && !t.synced_at) ? `${s.trips.filter(t=>t.status==='finished' && !t.synced_at).length} viagens pendentes` : `Tudo sincronizado ${m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString('pt-BR') : ''}`}</p><button className=\"link full\" onClick={() => navigate('/history')}")
edit('src/screens/Screens.tsx','{t.statuses[trip.sync_status]}',"{trip.synced_at ? 'Enviada' : trip.sync_status === 'error' ? 'Erro' : 'Pendente'}")
edit('src/screens/Screens.tsx','<GpsDiagnostics monitor={m}/><section', '<GpsDiagnostics monitor={m}/><section className="card"><label><input type="checkbox" checked={m.cloudEnabled} onChange={e=>void m.setCloudEnabled(e.target.checked)}/>Nuvem ligada</label><p>Última sincronização: {m.lastCloudSync ? new Date(m.lastCloudSync).toLocaleString("pt-BR") : "Nunca"}</p></section><section')
