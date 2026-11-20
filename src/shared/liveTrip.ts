// Acompanhamento ao vivo. O celular (anon) só tem permissão de INSERT na nuvem (sem UPDATE), então a viagem em andamento
// é enviada como uma viagem "sombra" (id derivado, status 'live', ended_at nulo). Ao finalizar, a viagem real é enviada
// inteira como sempre (com extra.live_id) e o painel esconde a sombra. Ver docs/AO_VIVO.md.
export const LIVE_STATUS = 'live';
export const LIVE_INTERVAL_MS = 15000;
export const LIVE_BATCH = 100;
export const LIVE_MAX_BATCHES = 5;
/** id da sombra: troca o nibble de versão (14º hex) por '8'; ids reais (UUID v4) nunca têm '8' ali. */
export const liveTripId = (tripId: string) => tripId.slice(0, 14) + '8' + tripId.slice(15);
