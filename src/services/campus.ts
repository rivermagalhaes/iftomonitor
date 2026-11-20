import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { GpsPoint, Trip } from '../data/models';
import { chronological } from '../lib/geo';

/** Posição atual do aparelho (para definir o campus). */
export async function currentPosition(): Promise<{ latitude: number; longitude: number }> {
    if (Capacitor.isNativePlatform()) {
        const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
        return { latitude: p.coords.latitude, longitude: p.coords.longitude };
    }
    if (!navigator.geolocation) throw new Error('Localização indisponível neste aparelho.');
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => reject(new Error('Não foi possível obter a posição atual. Verifique a permissão de localização.')),
        { enableHighAccuracy: true, timeout: 20000 }));
}

/** Último ponto aceito da viagem finalizada mais recente. */
export function lastTripEnd(trips: Trip[], points: GpsPoint[]): { latitude: number; longitude: number } | null {
    const finished = trips.filter(t => t.status === 'finished').sort((a, b) => b.started_at.localeCompare(a.started_at));
    for (const trip of finished) {
        const last = chronological(points.filter(p => p.trip_id === trip.id && p.accepted)).at(-1);
        if (last) return { latitude: last.latitude, longitude: last.longitude };
    }
    return null;
}
