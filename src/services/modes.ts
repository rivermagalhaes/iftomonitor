import { databaseName, initialize, type Repository } from '../data/repository';
import type { Mode } from '../data/models';
import { t } from '../i18n/pt-BR';
export const allowLocalFieldMode = () => import.meta.env.VITE_ALLOW_LOCAL_FIELD_MODE !== 'false';
export async function acceptConsent(repo: Repository, label: string, accepted: boolean) { if (!label.trim() || !accepted)
    throw new Error(t.operatorRequired); await repo.put('app_meta', { key: 'operator_label', value: label.trim().slice(0, 40) }); await repo.put('app_meta', { key: 'consent_version', value: t.consentVersion }); await repo.put('app_meta', { key: 'consent_accepted_at', value: new Date().toISOString() }); }
export async function authorize(repo: Repository, mode: Mode, userId: string | null) { if (repo.name !== databaseName(mode))
    throw new Error(t.error); if (mode === 'demo')
    return; if (mode === 'authenticated' && userId)
    return; if (mode === 'field' && allowLocalFieldMode() && (await repo.get('app_meta', 'consent_version'))?.value === t.consentVersion && (await repo.get('app_meta', 'consent_accepted_at'))?.value && (await repo.get('app_meta', 'operator_label'))?.value)
    return; throw new Error(t.operatorRequired); }
export async function openMode(mode: Mode, open: (name: string) => Promise<Repository>) { const repo = await open(databaseName(mode)); await initialize(repo); return repo; }
