import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { acceptTerms, getAppMode, markMonitorSetupDone, monitorSetupDone, resolveInitialMode, setAppMode, termsAccepted } from '../src/services/appMode';
import { MONITOR_CODE_HASH, hashMonitorCode, verifyMonitorCode } from '../src/config/monitorCode';
import { ModeChoice, MonitorSetup, TermsScreen } from '../src/screens/Onboarding';
import { MonitorPermissions, type PermissionDeps } from '../src/services/monitorPermissions';
import { MemoryReportStore, NetworkError, ReportQueue, type ReportTransport } from '../src/services/reports';
import { QuickReport } from '../src/shared/QuickReport';
import { toPayloadFields, type ReportForm } from '../src/shared/reportForm';
import { Monitor } from '../src/services/monitor';
import { memoryRepository } from './support';
import type { LocationProvider } from '../src/services/location';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

test('aceite dos termos é por versão, com data/hora', () => {
    const store = memory();
    expect(termsAccepted(store, '2.2')).toBe(false);
    acceptTerms(store, '2.2', new Date('2026-11-20T10:00:00Z'));
    expect(termsAccepted(store, '2.2')).toBe(true);
    expect(JSON.parse(store.getItem('ifto_terms')!)).toEqual({ version: '2.2', accepted_at: '2026-11-20T10:00:00.000Z' });
    expect(termsAccepted(store, '2.3')).toBe(false);
});
test('escolha de modo é salva; migração: quem já tem viagens vira monitor sem código', async () => {
    const store = memory();
    expect(getAppMode(store)).toBeNull();
    expect(await resolveInitialMode(store, async () => false)).toBeNull();
    expect(await resolveInitialMode(store, async () => true)).toBe('monitor');
    expect(getAppMode(store)).toBe('monitor');
    const other = memory(); setAppMode('aluno', other);
    expect(await resolveInitialMode(other, async () => true)).toBe('aluno');
    expect(monitorSetupDone(store)).toBe(false); markMonitorSetupDone(store); expect(monitorSetupDone(store)).toBe(true);
});
test('código do monitor: hash SHA-256 com salt', async () => {
    expect(MONITOR_CODE_HASH).toMatch(/^[0-9a-f]{64}$/);
    expect(await verifyMonitorCode('IFTO2026')).toBe(true);
    expect(await verifyMonitorCode(' IFTO2026 ')).toBe(true);
    expect(await verifyMonitorCode('ifto2026')).toBe(false);
    expect(await verifyMonitorCode('')).toBe(false);
    expect(await hashMonitorCode('IFTO2026')).toBe(MONITOR_CODE_HASH);
});
test('termos exigem "Li e concordo" para continuar', () => {
    const accept = vi.fn();
    render(<TermsScreen onAccept={accept}/>);
    const go = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;
    expect(go.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Li e concordo'));
    expect(go.disabled).toBe(false); fireEvent.click(go); expect(accept).toHaveBeenCalled();
});
test('escolha: aluno vai direto; monitor pede o código e código errado volta à escolha', async () => {
    const student = vi.fn(), monitor = vi.fn();
    render(<ModeChoice onStudent={student} onMonitor={monitor}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Sou aluno' })); expect(student).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sou monitor/ }));
    fireEvent.change(screen.getByLabelText('Código do monitor'), { target: { value: 'errado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    await screen.findByText('Código incorreto. Escolha novamente.');
    expect(monitor).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sou monitor/ }));
    fireEvent.change(screen.getByLabelText('Código do monitor'), { target: { value: 'IFTO2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    await waitFor(() => expect(monitor).toHaveBeenCalled());
});
const api = (state: { loc: boolean; fg: boolean; notif: boolean; bat: boolean }) => { const mock = { checkPermissions: vi.fn(async () => ({ location: state.fg ? 'granted' : 'denied', backgroundLocation: state.loc ? 'granted' : 'denied', notification: state.notif ? 'granted' : 'denied' })), requestPermissions: vi.fn(async (o: { permissions?: string[] }) => { if (o.permissions?.includes('location')) state.fg = true; if (o.permissions?.includes('backgroundLocation')) state.loc = true; if (o.permissions?.includes('notification')) state.notif = true; return {}; }), openSettings: vi.fn(async () => { }) };
    return { mock, api: mock as unknown as PermissionDeps['api'], native: true, battery: async () => state.bat, requestBattery: vi.fn(async () => { state.bat = true; return true; }) };
};
test('permissões do monitor: etapa pendente única, flags e fora do Android tudo ok', async () => {
    const state = { loc: false, fg: false, notif: false, bat: false };
    const p = new MonitorPermissions(api(state));
    expect(p.pending(await p.read())).toBe('location');
    expect((await p.request('location')).done).toBe(true);
    expect(await p.read()).toMatchObject({ locationAlways: true, notifications: false, batteryExempt: false });
    expect(p.pending(await p.read())).toBe('notifications');
    await p.request('notifications'); expect(p.pending(await p.read())).toBe('battery');
    await p.request('battery'); expect(p.pending(await p.read())).toBeNull();
    const web = new MonitorPermissions({ ...api(state), native: false });
    expect(await web.read()).toMatchObject({ batteryExempt: true, locationAlways: true, notifications: true });
});
test('só "durante o uso": pede para abrir as permissões do app', async () => {
    const state = { loc: false, fg: true, notif: true, bat: true };
    const deps = api(state); deps.mock.requestPermissions = vi.fn(async () => ({}));
    const p = new MonitorPermissions(deps);
    expect(await p.request('location')).toEqual({ done: false, needsSettings: true });
    render(<MonitorSetup permissions={p} onDone={() => { }}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir localização' }));
    await screen.findByText('Escolha Permitir o tempo todo.');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir permissões do app' }));
    await waitFor(() => expect(deps.mock.openSettings).toHaveBeenCalled());
});
test('assistente do monitor avança em sequência e termina em Tudo pronto', async () => {
    const state = { loc: false, fg: false, notif: false, bat: false }, done = vi.fn();
    render(<MonitorSetup permissions={new MonitorPermissions(api(state))} onDone={done}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir localização' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir avisos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir uso contínuo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ir para o início' }));
    expect(done).toHaveBeenCalled();
});

test('fila offline de relatos reenvia quando a conexão volta', async () => {
    let online = false; const sent: string[] = [];
    const transport: ReportTransport = { async send(r) { if (!online) throw new NetworkError(); sent.push(r.id); } };
    const queue = new ReportQueue(new MemoryReportStore(), transport, () => online);
    const saved = await queue.submit({ bus_label: 'Ônibus 01', route_name: 'Serrano', category: 'atraso', message: '[v1|bus=01|rota=Serrano|quando=agora|problemas=atraso_15]', photos: [] });
    expect(saved?.status).toBe('pendente'); expect(sent).toEqual([]);
    online = true; await queue.flush();
    expect(sent).toEqual([saved!.id]); expect(queue.getSnapshot()[0].status).toBe('enviado');
    expect(await queue.submit({ bus_label: 'Ônibus 01', category: 'atraso', message: 'x', photos: [], honeypot: 'spam' })).toBeNull();
});

const stubs = { pickPhoto: async () => null, submit: vi.fn(async () => 'enviado' as const), buses: ['Ônibus 01', 'Ônibus 02', 'Ônibus 03'] };
test('formulário em uma tela: tudo visível, barra fixa com 3 botões e contador', () => {
    render(<QuickReport {...stubs}/>);
    expect(screen.getByText('Relatar problema')).toBeTruthy();
    expect(screen.getByText('0 marcados')).toBeTruthy();
    expect(screen.getByText('Emergência agora? Ligue 190, 193 ou 192.')).toBeTruthy();
    for (const b of ['Ônibus 01', 'Ônibus 02', 'Ônibus 03', 'Não sei']) expect(screen.getByRole('button', { name: b })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^(Quebrou na estrada|Atrasou|Superlotado|Sem cinto|Não passou|Alta velocidade|Pneu furado|Muito quente)$/ })).toHaveLength(8);
    expect(screen.getAllByRole('button', { expanded: false })).toHaveLength(8) // 7 categorias + Descrever;
    expect(screen.getByRole('button', { name: 'Tirar foto' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descrever' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar relato' })).toBeTruthy();
});
test('Mais comuns e lista completa compartilham o mesmo estado', () => {
    render(<QuickReport {...stubs}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Sem cinto' }));
    expect(screen.getByText('1 marcados', { selector: '.qrCount' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Segurança/ }));
    const box = screen.getByLabelText('Sem cinto de segurança (ou cinto quebrado)') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Superlotado / gente em pé'));
    expect(screen.getByRole('button', { name: 'Superlotado' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('2 marcados', { selector: '.qrAccInfo' })).toBeTruthy();
    fireEvent.click(box);
    expect(screen.getByRole('button', { name: 'Sem cinto' }).getAttribute('aria-pressed')).toBe('false');
});
test('enviar sem marcar não é bloqueado: mostra a mensagem', async () => {
    const submit = vi.fn(async () => 'enviado' as const);
    render(<QuickReport {...stubs} submit={submit} preset={{ bus: 'Ônibus 02' }}/>);
    const send = screen.getByRole('button', { name: 'Enviar relato' }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    await screen.findByText('Marque pelo menos um problema.');
    expect(submit).not.toHaveBeenCalled();
});
test('enviar: ônibus pré-marcado, descrição e linha estruturada; depois Fazer outro relato', async () => {
    const submit = vi.fn(async () => 'enviado' as const);
    render(<QuickReport {...stubs} submit={submit} preset={{ bus: 'Ônibus 03' }}/>);
    expect(screen.getByRole('button', { name: 'Ônibus 03' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Superlotado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descrever' }));
    fireEvent.change(screen.getByLabelText('Descreva o problema'), { target: { value: 'gente em pé' } });
    expect(screen.getByRole('button', { name: 'Descrever ✓' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relato' }));
    await screen.findByText('Relato enviado, obrigado!');
    const form = (submit.mock.calls[0] as unknown as [ReportForm])[0];
    expect(form).toMatchObject({ bus: 'Ônibus 03', problems: ['superlotado'], quando: 'agora', comment: 'gente em pé' });
    expect(toPayloadFields(form).message).toMatch(/^\[v1\|bus=03\|sentido=(ida|volta)\|quando=agora\|problemas=superlotado\] gente em pé$/);
    fireEvent.click(screen.getByRole('button', { name: 'Fazer outro relato' }));
    expect(screen.getByText('0 marcados')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ônibus 03' }).getAttribute('aria-pressed')).toBe('true');
});
test('foto: rótulo vira Foto (1) e aceita no máximo 2', async () => {
    const pick = vi.fn(async () => new Blob(['x'], { type: 'image/jpeg' }));
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn();
    render(<QuickReport {...stubs} pickPhoto={pick}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Tirar foto' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Foto (1)' }));
    await screen.findByRole('button', { name: 'Foto (2)' });
    expect((screen.getByRole('button', { name: 'Foto (2)' }) as HTMLButtonElement).disabled).toBe(true);
    expect(pick).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover foto' })[0]);
    expect(screen.getByRole('button', { name: 'Foto (1)' })).toBeTruthy();
});

const gps = (): LocationProvider => ({ onFix: () => { }, onError: () => { }, onStatus: () => { }, preserveAll: true, requestPermission: vi.fn(async () => { }), start: vi.fn(async () => { }), stop: vi.fn(async () => { }) });
test('trip_started grava batteryExempt, locationAlways e notifications; só a etapa pendente é pedida', async () => {
    const repo = memoryRepository('ifto_monitor'), state = { loc: true, fg: true, notif: true, bat: false };
    const deps = api(state), permissions = new MonitorPermissions(deps);
    const monitor = new Monitor(async () => repo, () => gps(), permissions);
    await monitor.enter('field', 'AB', true); await monitor.saveBusLabel('Ônibus 01');
    await monitor.start(monitor.snapshot.vehicles[0].id);
    expect(deps.requestBattery).toHaveBeenCalledTimes(1);
    expect(deps.mock.requestPermissions).not.toHaveBeenCalled();
    const started = monitor.snapshot.active!.events!.find(e => e.type === 'trip_started')!;
    expect(started.details).toEqual({ batteryExempt: true, locationAlways: true, notifications: true });
    await monitor.dispose();
});
test('rota do aluno não importa Monitor nem plugins de geolocalização', async () => {
    const { readFileSync } = await import('node:fs');
    for (const f of ['src/screens/Student.tsx', 'src/services/reports.ts', 'src/shared/QuickReport.tsx']) {
        const src = readFileSync(f, 'utf8');
        expect(src).not.toMatch(/geolocation|background-geolocation|services\/monitor'|services\/location/);
    }
});
void MemoryRouter;
