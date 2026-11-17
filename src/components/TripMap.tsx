import { haversine, analyzeTrack, durationMMSS } from '../lib/geo';
import { useState } from 'react';
import type { GpsPoint, Stop } from '../data/models';
import { t } from '../i18n/pt-BR';
const mercator = (latitude: number, longitude: number) => ({ x: (longitude + 180) / 360, y: (1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 });
// Enquadramento do SVG em pixels, equivalente a fitBounds com padding 32 e maxZoom 18.
export function fitBounds(width: number, height: number, short: boolean) {
    if (short) return 17;
    const scale = Math.min(336 / Math.max(width, 1e-12), 216 / Math.max(height, 1e-12));
    return Math.max(2, Math.min(18, Math.log2(scale / 256)));
}
export function TripMap({ points, stops, online, intervalMs = 10000 }: {
    points: GpsPoint[];
    stops: Stop[];
    online: boolean;
    intervalMs?: number;
}) {
    const [failed, setFailed] = useState(false);
    const track = analyzeTrack(points, intervalMs);
    const good = track.accepted;
    const visibleStops = stops.filter(s => s.status !== 'descartada');
    const all = good.length ? good : visibleStops;
    const coord = all.map(p => mercator(p.latitude, p.longitude));
    const minX = Math.min(...coord.map(p => p.x)), maxX = Math.max(...coord.map(p => p.x)), minY = Math.min(...coord.map(p => p.y)), maxY = Math.max(...coord.map(p => p.y));
    const cx = coord.length ? (minX + maxX) / 2 : .366, cy = coord.length ? (minY + maxY) / 2 : .528;
    const short = all.length > 0 && all.every(a => all.every(b => haversine(a, b) < 30));
    const zoom = fitBounds(maxX - minX, maxY - minY, short);
    const tileZoom = Math.floor(zoom), tileSize = 256 * 2 ** (zoom - tileZoom);
    const scale = 256 * 2 ** zoom;
    const project = (p: {
        latitude: number;
        longitude: number;
    }) => { const a = mercator(p.latitude, p.longitude); return [(a.x - cx) * scale + 200, (a.y - cy) * scale + 140]; };
    const tiles = [];
    const url = import.meta.env.VITE_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    if (online && !failed && coord.length) {
        const tx = Math.floor(cx * 2 ** tileZoom), ty = Math.floor(cy * 2 ** tileZoom);
        for (let x = tx - 1; x <= tx + 1; x++)
            for (let y = ty - 1; y <= ty + 1; y++)
                tiles.push(<image key={`${zoom}-${x}-${y}`} href={url.replace('{z}', String(tileZoom)).replace('{x}', String(x)).replace('{y}', String(y))} x={x * tileSize - cx * scale + 200} y={y * tileSize - cy * scale + 140} width={tileSize} height={tileSize} onError={() => setFailed(true)}/>);
    }
    const first = good[0], last = good.at(-1);
    return <div className="map" role="img" aria-label={t.mapLabel}><svg viewBox="0 0 400 280"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-soft)" strokeWidth="1"/></pattern></defs><rect width="400" height="280" fill="url(#grid)"/>{tiles}{track.segments.filter(segment => segment.length >= 2).map((segment, index) => <polyline key={index} points={segment.map(p => project(p).join(',')).join(' ')} fill="none" stroke="var(--color-primary)" strokeWidth="4"/>)}{track.gaps.map((gap, index) => <g key={'gap-' + index} data-gap="true"><line x1={project(gap.before)[0]} y1={project(gap.before)[1]} x2={project(gap.after)[0]} y2={project(gap.after)[1]} stroke="#75818A" strokeWidth="1.5" strokeDasharray="5 5"><title>Sem sinal por {durationMMSS(gap.seconds)}</title></line>{[gap.before, gap.after].map((p, side) => <circle key={side} cx={project(p)[0]} cy={project(p)[1]} r="5" fill="#FFF3CD" stroke="#75818A" strokeWidth="2"><title>{side === 0 ? 'Início' : 'Fim'} da lacuna: {durationMMSS(gap.seconds)}</title></circle>)}</g>)}{first && <circle cx={project(first)[0]} cy={project(first)[1]} r="7" fill="var(--color-dark)" stroke="white" strokeWidth="2"><title>{t.startPoint}</title></circle>}{last && <circle cx={project(last)[0]} cy={project(last)[1]} r="6" fill="var(--color-danger)" stroke="white" strokeWidth="2"><title>{t.endPoint} / {t.currentPoint}</title></circle>}{visibleStops.map((stop, index) => <g key={stop.id}><circle cx={project(stop)[0]} cy={project(stop)[1]} r="8" fill={stop.status === 'confirmada' ? 'var(--color-dark)' : 'var(--color-light)'} stroke="white" strokeWidth="2"><title>{stop.label}</title></circle><text x={project(stop)[0]} y={project(stop)[1] + 3} textAnchor="middle" fontSize="10" fill={stop.status === 'confirmada' ? 'white' : 'var(--color-dark)'}>{index + 1}</text></g>)}</svg>{track.gaps.length > 0 && <div className="gapLegend">{track.gaps.map((gap, i) => <div key={i}>Sem sinal por {durationMMSS(gap.seconds)}</div>)}</div>}<div className="mapNote">{(!online || failed) && <span>{t.mapUnavailable} Â· </span>}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{t.osm}</a></div>{(!online || failed) && <details className="coordinateFallback"><summary>Coordenadas do trajeto</summary><ol>{good.map(p => <li key={p.id}>{p.latitude.toFixed(6)}, {p.longitude.toFixed(6)}</li>)}</ol></details>}</div>;
}
