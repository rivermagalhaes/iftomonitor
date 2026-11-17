import { mergeStops } from './stops';
import { localTimestamp } from '../lib/time';
import { analyzeTrack, chronological } from '../lib/geo';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { Trip, GpsPoint, Stop, Mode } from '../data/models';
import { t } from '../i18n/pt-BR';
const pointColumns = ['trip_id', 'bus_label', 'route', 'seq', 'recorded_at', 'recorded_at_local', 'latitude', 'longitude', 'accuracy_m', 'speed_mps', 'accepted', 'source', 'device_id', 'gap_before_s', 'suspect', 'app_version'] as const;
const stopColumns = ['stop_id', 'trip_id', 'bus_label', 'route', 'arrived_at', 'arrived_at_local', 'departed_at', 'departed_at_local', 'duration_s', 'latitude', 'longitude', 'status', 'label', 'detected_by', 'app_version'] as const;
export const csvCell = (value: unknown) => { const text = value === null || value === undefined ? '' : String(value); return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text; };
const csv = (headers: readonly string[], rows: unknown[][]) => '\uFEFF' + [headers.join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n') + '\r\n';
export function pointsCsv(points: GpsPoint[], intervalMs = 10000, context: Trip | string = '') {
    const track = analyzeTrack(points, intervalMs);
    const trip = typeof context === 'string' ? null : context;
    return csv(pointColumns, chronological(points).map(p => pointColumns.map(key => {
        if (key === 'route') return trip?.route_name || (typeof context === 'string' ? context : '');
        if (key === 'bus_label') return trip?.bus_label || '';
        if (key === 'app_version') return trip?.app_version || '';
        if (key === 'recorded_at_local') return localTimestamp(p.recorded_at);
        return (track.annotated.get(p.id) || p)[key];
    })));
}
export function stopsCsv(stops: Stop[], context: Trip | string = '') {
    const trip = typeof context === 'string' ? null : context;
    return csv(stopColumns, mergeStops(stops).map(p => stopColumns.map(key => {
        if (key === 'stop_id') return p.id;
        if (key === 'route') return trip?.route_name || (typeof context === 'string' ? context : '');
        if (key === 'bus_label' || key === 'app_version') return trip?.[key] || '';
        if (key === 'arrived_at_local') return localTimestamp(p.arrived_at);
        if (key === 'departed_at_local') return localTimestamp(p.departed_at);
        return p[key];
    })));
}
export function eventsCsv(trip: Trip) {
    return csv(['trip_id', 'bus_label', 'route', 'event_type', 'occurred_at', 'occurred_at_local', 'detail', 'app_version'], [...(trip.events || [])].sort((a,b) => a.at.localeCompare(b.at)).map(event => [trip.id, trip.bus_label || '', trip.route_name || '', event.type, event.at, localTimestamp(event.at), JSON.stringify(event.details), trip.app_version || '']));
}
export function geoJson(trip: Trip, points: GpsPoint[], stops: Stop[], intervalMs = 10000) {
    const track = analyzeTrack(points, intervalMs);
    const metadata = { trip_id: trip.id, vehicle: trip.vehicle_label_snapshot, bus_label: trip.bus_label || '', app_version: trip.app_version || '', started_at_local: localTimestamp(trip.started_at), ended_at_local: localTimestamp(trip.ended_at), started_at: trip.started_at, ended_at: trip.ended_at, device_id: trip.device_id, route: trip.route_name || '', route_id: trip.route_id || null, events: trip.events || [] };
    const line = (segment: GpsPoint[]) => segment.map(p => [p.longitude, p.latitude]);
    return { type: 'FeatureCollection', features: [
        ...(track.segments.length ? track.segments : [[]]).map(segment => ({ type: 'Feature', geometry: segment.length >= 2 ? { type: 'LineString', coordinates: line(segment) } : null, properties: { ...metadata, type: 'track' } })),
        ...mergeStops(stops).map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] }, properties: { stop_id: s.id, trip_id: s.trip_id, arrived_at: s.arrived_at, departed_at: s.departed_at, duration_s: s.duration_s, status: s.status, label: s.label, detected_by: s.detected_by, type: 'stop' } })),
        ...track.accepted.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] }, properties: { trip_id: trip.id, type: 'gps_point', seq: p.seq, recorded_at: p.recorded_at, gap_before_s: p.gap_before_s ?? null, suspect: !!p.suspect, accuracy_m: p.accuracy_m } })),
        ...track.gaps.map(gap => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: line([gap.before, gap.after]) }, properties: { trip_id: trip.id, type: 'gap', gap_before_s: gap.seconds, started_at: gap.before.recorded_at, ended_at: gap.after.recorded_at } }))
    ] };
}
export function exportName(trip: Trip, mode: Mode) {
    const slug = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const bus = slug(trip.bus_label || trip.vehicle_label_snapshot || 'Sem-onibus');
    const route = '_' + (slug(trip.route_name || '') || 'sem-rota');
    const time = localTimestamp(trip.started_at).replace(/[-:]/g, '').replace(' ', '-').slice(0, 13);
    return `ifto-monitor_${mode === 'demo' ? 'demo_' : ''}${bus}${route}_${time}_${trip.id.slice(0, 8)}`;
}
export interface NativeFiles {
    writeFile(options: {
        path: string;
        data: string;
        directory: 'CACHE';
        encoding: 'utf8';
    }): Promise<{
        uri: string;
    }>;
    share(options: {
        files: string[]; title?: string; dialogTitle?: string;
    }): Promise<unknown>;
}
export async function downloadFile(name: string, content: string, mime: string, native?: NativeFiles) { try {
    native ??= Capacitor.isNativePlatform() ? { writeFile: options => Filesystem.writeFile({ ...options, directory: Directory.Cache, encoding: Encoding.UTF8 }), share: options => Share.share(options) } : undefined;
    if (native) {
        const file = await native.writeFile({ path: name, data: content, directory: 'CACHE', encoding: 'utf8' });
        await native.share({ files: [file.uri], title: name, dialogTitle: name });
        return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
catch (error) {
    throw new Error(error instanceof Error && error.message ? error.message : t.exportError);
} }
export type ExportFormat = 'csv' | 'geojson' | 'events';
export async function exportTrip(trip: Trip, points: GpsPoint[], stops: Stop[], mode: Mode, format: ExportFormat | ExportFormat[], native?: NativeFiles, intervalMs = 10000) {
    const name = exportName(trip, mode);
    const formats = [...new Set(Array.isArray(format) ? format : [format])];
    const files: { name: string; content: string; mime: string }[] = [];
    for (const selected of formats) {
        if (selected === 'csv') {
            files.push({ name: name + '.csv', content: pointsCsv(points, intervalMs, trip), mime: 'text/csv;charset=utf-8' });
            files.push({ name: name + '_stops.csv', content: stopsCsv(stops, trip), mime: 'text/csv;charset=utf-8' });
        } else if (selected === 'events') files.push({ name: name + '_eventos.csv', content: eventsCsv(trip), mime: 'text/csv;charset=utf-8' });
        else files.push({ name: name + '.geojson', content: JSON.stringify(geoJson(trip, points, stops, intervalMs), null, 2), mime: 'application/geo+json' });
    }
    native ??= Capacitor.isNativePlatform() ? { writeFile: options => Filesystem.writeFile({ ...options, directory: Directory.Cache, encoding: Encoding.UTF8 }), share: options => Share.share(options) } : undefined;
    if (native) {
        const uris: string[] = [];
        for (const file of files) uris.push((await native.writeFile({ path: file.name, data: file.content, directory: 'CACHE', encoding: 'utf8' })).uri);
        try { await native.share({ files: uris, title: name, dialogTitle: name }); }
        catch (error) {
            const code = (error as {code?: string}).code;
            const message = error instanceof Error ? error.message : '';
            if (uris.length < 2 || !(/unsupported|not supported|not implemented/i.test(message) || code === 'UNIMPLEMENTED')) throw error;
            for (const uri of uris) await native.share({ files: [uri], title: name, dialogTitle: name });
        }
    } else for (const file of files) await downloadFile(file.name, file.content, file.mime);
}
