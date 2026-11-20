export type StatusKind = 'idle' | 'recording' | 'pending' | 'error';
export interface StatusInput { recording: boolean; locationDenied: boolean; syncError: boolean; syncPending: boolean }
/** Cinza = parado, verde = gravando, amarelo = pendências de sincronização, vermelho = erro real (sem permissão de localização na viagem ou falha de sincronização). */
export function statusKind(i: StatusInput): StatusKind {
    if ((i.recording && i.locationDenied) || i.syncError) return 'error';
    if (i.recording) return 'recording';
    return i.syncPending ? 'pending' : 'idle';
}
export const statusLabels: Record<StatusKind, string> = { idle: 'Parado', recording: 'Gravando viagem', pending: 'Itens pendentes de sincronização', error: 'Erro: verifique a permissão de localização ou a sincronização' };
