export type Mode = 'demo' | 'field' | 'authenticated';
export type SyncStatus = 'pending' | 'synced' | 'error';
export interface SyncFields {
    synced_at?: string | null;
    sync_status: SyncStatus;
    sync_attempts: number;
    last_error: string | null;
    next_retry_at?: string | null;
}
export interface Vehicle extends SyncFields {
    id: string;
    label: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}
export interface Route extends SyncFields {
    id: string;
    name: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}
export interface TripEvent {
    synced_at?: string | null;
    type: 'trip_started' | 'trip_finished' | 'paused' | 'resumed' | 'gps_lost' | 'gps_restored' | 'permission_changed' | 'watchdog_restarted' | 'recording_interrupted' | 'recording_resumed' | 'app_restarted' | 'route_changed' | 'route_edited';
    at: string;
    details: Record<string, unknown>;
}
export interface Trip extends SyncFields {
    id: string;
    vehicle_id: string;
    vehicle_label_snapshot: string;
    owner_user_id: string | null;
    operator_label: string;
    status: 'recording' | 'finished';
    started_at: string;
    ended_at: string | null;
    ended_reason: 'user' | 'recovered' | null;
    device_id: string;
    paused?: boolean;
    bus_label?: string;
    app_version?: string;
    gps_interval_ms?: number;
    route_id?: string | null;
    route_name?: string;
    /** v2.3: quem registrou a viagem (cadastro rápido). Vai à nuvem em `extra.user`. */
    user?: { name: string; email: string };
    /** v2.1: turno manual da viagem para a pontualidade (ausente = auto). */
    shift_override?: 'auto' | 'manha' | 'noite' | 'ignorar';
    events?: TripEvent[];
    created_at: string;
    updated_at: string;
}
export interface GpsPoint extends SyncFields {
    id: string;
    trip_id: string;
    seq: number;
    latitude: number;
    longitude: number;
    accuracy_m: number;
    speed_mps: number | null;
    recorded_at: string;
    received_at: string;
    device_id: string;
    source: 'gps' | 'demo';
    accepted: boolean;
    suspect?: boolean;
    gap_before_s?: number;
}
export interface Stop extends SyncFields {
    id: string;
    trip_id: string;
    arrived_at: string;
    departed_at: string | null;
    duration_s: number;
    latitude: number;
    longitude: number;
    avg_accuracy_m: number;
    status: 'candidata' | 'confirmada' | 'descartada';
    label: string;
    detected_by: 'auto' | 'manual' | 'auto+manual';
    manually_confirmed?: boolean;
    created_at: string;
    updated_at: string;
}
export interface AppMeta {
    key: string;
    value: string;
}
export interface Tables {
    app_meta: AppMeta;
    vehicles: Vehicle;
    routes: Route;
    trips: Trip;
    gps_points: GpsPoint;
    stops: Stop;
}
export type Table = keyof Tables;
export const tableNames: Table[] = ['app_meta', 'vehicles', 'routes', 'trips', 'gps_points', 'stops'];
export const pending: SyncFields = { synced_at: null, sync_status: 'pending', sync_attempts: 0, last_error: null };
export interface Settings {
    gpsIntervalMs: number;
    maxAccuracyM: number;
    stopSpeedKmh: number;
    stopMinDurationS: number;
    stopRadiusM: number;
    maxGapS: number;
}
export const defaults: Settings = { gpsIntervalMs: Number(import.meta.env.VITE_GPS_INTERVAL_MS) || 10000, maxAccuracyM: 50, stopSpeedKmh: 3, stopMinDurationS: 15, stopRadiusM: 25, maxGapS: Math.max(60, 3 * (Number(import.meta.env.VITE_GPS_INTERVAL_MS) || 10000) / 1000) };
