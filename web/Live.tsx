// Painel (#/painel/ao-vivo): ônibus em viagem agora, no mapa (Leaflet + OpenStreetMap, sem chave de API). Somente leitura, só admin.
import { useCallback, useEffect, useRef, useState } from 'react';
import L, { type Map as LMap, type LayerGroup, type CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { WebClient } from './client';
import { CAMPUS_CENTER, LIVE_WINDOW_MS, POLL_MS, TRAIL_MS, activeLiveTrips, formatAge, liveState, pickLastPoint, type LivePoint, type LiveTrip } from '../src/lib/live';
import { SPEED_HIGH_KMH, SPEED_WARN_KMH } from '../src/config/reference';
import { localHM } from '../src/lib/time';

interface Item { trip: LiveTrip; trail: LivePoint[] }
const pointCols = 'trip_id,seq,recorded_at,latitude,longitude,accuracy_m,speed_mps,accepted';
const hms = (d: Date) => d.toLocaleTimeString('pt-BR');

function LiveMap({ items, now, focusId }: { items: Item[]; now: number; focusId: string | null }) {
    const el = useRef<HTMLDivElement>(null), map = useRef<LMap | null>(null), layer = useRef<LayerGroup | null>(null), fitted = useRef(false), markers = useRef(new Map<string, CircleMarker>());
    useEffect(() => {
        if (!el.current) return;
        const m = L.map(el.current).setView(CAMPUS_CENTER, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(m);
        layer.current = L.layerGroup().addTo(m); map.current = m;
        return () => { m.remove(); map.current = null; layer.current = null; markers.current.clear(); fitted.current = false; };
    }, []);
    useEffect(() => {
        const g = layer.current, m = map.current; if (!g || !m) return;
        g.clearLayers(); markers.current.clear();
        const bounds: [number, number][] = [];
        for (const { trip, trail } of items) {
            const last = pickLastPoint(trail), state = liveState(trail, now); if (!last || !state) continue;
            const pos: [number, number] = [last.latitude, last.longitude]; bounds.push(pos);
            if (trail.length > 1) L.polyline(trail.map(p => [p.latitude, p.longitude] as [number, number]), { color: state.color, weight: 4, opacity: .7 }).addTo(g);
            const label = `${trip.bus_label || 'Ônibus'}${state.stale ? '' : state.speedKmh === null ? '' : ` · ${state.speedKmh} km/h`}`;
            const marker = L.circleMarker(pos, { radius: 12, color: '#fff', weight: 3, fillColor: state.color, fillOpacity: 1 }).addTo(g);
            marker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -10] });
            const pop = document.createElement('div');
            for (const line of [trip.bus_label || 'Ônibus', trip.route_name || 'Sem rota', state.speedKmh === null ? 'Velocidade: —' : `Velocidade: ${state.speedKmh} km/h`, state.text]) { const p = document.createElement('div'); p.textContent = line; pop.append(p); }
            marker.bindPopup(pop); markers.current.set(trip.id, marker);
        }
        if (!fitted.current && bounds.length) { fitted.current = true; m.fitBounds(L.latLngBounds(bounds), { maxZoom: 16, padding: [40, 40] }); }
    }, [items, now]);
    useEffect(() => { const mk = focusId ? markers.current.get(focusId) : null; if (mk && map.current) { map.current.setView(mk.getLatLng(), 16); mk.openPopup(); } }, [focusId]);
    return <div ref={el} className="liveMap" aria-label="Mapa dos ônibus em viagem"/>;
}

export function LivePanel({ db }: { db: WebClient | null }) {
    const [items, setItems] = useState<Item[]>([]), [error, setError] = useState(''), [updated, setUpdated] = useState<Date | null>(null), [now, setNow] = useState(Date.now()), [loading, setLoading] = useState(false), [focusId, setFocusId] = useState<string | null>(null);
    const busy = useRef(false);
    const load = useCallback(async () => {
        if (!db || busy.current) return;
        busy.current = true; setLoading(true);
        try {
            const t = Date.now(), since = new Date(t - LIVE_WINDOW_MS).toISOString(), sinceReal = new Date(t - LIVE_WINDOW_MS - 3600000).toISOString(), sinceTrail = new Date(t - TRAIL_MS).toISOString();
            const [live, finished] = await Promise.all([
                db.from('trips').select('id,bus_label,route_name,started_at,ended_at,status').eq('status', 'live').is('ended_at', null).gte('started_at', since).order('started_at', { ascending: false }).limit(50),
                db.from('trips').select('id,live_id:extra->>live_id').neq('status', 'live').gte('started_at', sinceReal).limit(500),
            ]);
            if (live.error) throw live.error; if (finished.error) throw finished.error;
            const done = new Set((finished.data as unknown as { live_id: string | null }[]).map(r => r.live_id).filter((v): v is string => !!v));
            const active = activeLiveTrips(live.data as unknown as LiveTrip[], done, t);
            const next = await Promise.all(active.map(async (trip): Promise<Item> => {
                let q = await db.from('trip_points').select(pointCols).eq('trip_id', trip.id).gte('recorded_at', sinceTrail).order('seq', { ascending: true }).limit(400);
                if (q.error) throw q.error;
                let pts = q.data as unknown as LivePoint[];
                if (!pts.length) { q = await db.from('trip_points').select(pointCols).eq('trip_id', trip.id).order('seq', { ascending: false }).limit(1); if (q.error) throw q.error; pts = q.data as unknown as LivePoint[]; }
                return { trip, trail: pts };
            }));
            setItems(next); setUpdated(new Date()); setNow(Date.now()); setError('');
        } catch (e) {
            const err = e as { message?: string; code?: string; details?: string };
            setError(`${err.message || String(e)}${err.code ? ` (${err.code})` : ''}${err.details ? ` — ${err.details}` : ''}`);
        } finally { busy.current = false; setLoading(false); }
    }, [db]);
    useEffect(() => { void load(); const poll = setInterval(() => void load(), POLL_MS), tick = setInterval(() => setNow(Date.now()), 5000); return () => { clearInterval(poll); clearInterval(tick); }; }, [load]);
    if (!db) return <section><h2>Ao vivo</h2><p role="status">Nuvem não configurada</p></section>;
    return <section><h2>Ao vivo</h2>
        <p>Ônibus com viagem em andamento. Atualiza sozinho a cada {POLL_MS / 1000} s. Cores da velocidade: verde abaixo de {SPEED_WARN_KMH}, amarelo de {SPEED_WARN_KMH} a {SPEED_HIGH_KMH - 1}, vermelho a partir de {SPEED_HIGH_KMH} km/h; cinza = sem sinal há mais de 2 min.</p>
        <div className="filters"><button type="button" disabled={loading} onClick={() => void load()}>{loading ? 'Atualizando…' : 'Atualizar agora'}</button>{updated && <span role="status">Última atualização: {hms(updated)}</span>}</div>
        {error && <p role="alert">Não foi possível ler os dados: {error}</p>}
        {!error && updated && !items.length && <p role="status">Nenhum ônibus em viagem agora.</p>}
        <div className="liveWrap">
            <LiveMap items={items} now={now} focusId={focusId}/>
            <ul className="liveList">{items.map(({ trip, trail }) => { const st = liveState(trail, now), last = pickLastPoint(trail); return <li key={trip.id}>
                <button type="button" onClick={() => setFocusId(`${trip.id}`)} style={{ borderLeft: `8px solid ${st?.color ?? '#6b7280'}`, textAlign: 'left', width: '100%' }}>
                    <strong>{trip.bus_label || 'Ônibus'}</strong> · {trip.route_name || 'Sem rota'}<br/>
                    {!st || !last ? 'Sem posição ainda' : st.stale ? `Sem sinal desde ${localHM(last.recorded_at)} (há ${formatAge(st.ageMs)})` : `${st.speedKmh === null ? '— km/h' : `${st.speedKmh} km/h`} · ${st.text}`}
                </button></li>; })}</ul>
        </div>
    </section>;
}
