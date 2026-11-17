import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncClient } from './sync';
export function supabaseSyncClient(client: SupabaseClient): SyncClient { return { async upsert(table, rows) { const { data, error } = await client.from(table).upsert(rows, { onConflict: 'id' }).select('id'); if (error)
        throw error; return { ids: (data || []).map(row => row.id as string) }; } }; }
