import { createClient } from '@supabase/supabase-js';
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
 trips: [{...pick(trip,['id','device_id','app_version','status']), bus_label: trip.bus_label || trip.vehicle_label_snapshot, route_name: trip.route_name || null, started_at: new Date(trip.started_at).toISOString(), ended_at: new Date(trip.ended_at!).toISOString(), distance_m: track.distance, duration_s: Math.round((Date.parse(trip.ended_at!)-Date.parse(trip.started_at))/1000), points_count: points.length, stops_count: stops.filter(s=>s.status!=='descartada').length, gap_count: track.gaps.length, gap_total_s: track.gapSeconds, extra: {user: trip.user ?? null, local:trip, point_metadata:points.map(p=>pick(p,['id','received_at','device_id'])), stop_metadata:stops.map(s=>pick(s,['id','avg_accuracy_m','manually_confirmed','created_at','updated_at']))}}],
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
 const stamp=new Date(now()).toISOString();let unchanged=true;
 for (const p of points) {const current=await repo.get('gps_points',p.id);if(JSON.stringify(current)!==JSON.stringify(p)){unchanged=false;continue;}await repo.put('gps_points',{...p,synced_at:stamp,sync_status:'synced',last_error:null});}
 for (const s of stops) {const current=await repo.get('stops',s.id);if(JSON.stringify(current)!==JSON.stringify(s)){unchanged=false;continue;}await repo.put('stops',{...s,synced_at:stamp,sync_status:'synced',last_error:null});}
 const current=await repo.get('trips',trip.id);
 if (unchanged && current && JSON.stringify(current)===JSON.stringify(trip)) await repo.put('trips',{...current,synced_at:stamp,sync_status:'synced',last_error:null,next_retry_at:null,events:(current.events||[]).map(e=>({...e,synced_at:stamp}))});
 await repo.put('app_meta',{key:'last_cloud_sync',value:stamp});
 } catch(e) { const current=await repo.get('trips',trip.id); if(current) {const attempts=current.sync_attempts+1;await repo.put('trips',{...current,sync_status:'error',sync_attempts:attempts,last_error:e instanceof Error?e.message:String(e),next_retry_at:new Date(now()+backoff(attempts)).toISOString()});} }
 } } finally {locks.delete(repo);}
}
