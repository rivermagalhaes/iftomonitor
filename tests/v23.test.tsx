import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { App, Root } from '../src/app/App';
import { Monitor } from '../src/services/monitor';
import { MonitorPermissions, type PermissionDeps } from '../src/services/monitorPermissions';
import { MemoryReportStore, ReportQueue, type ReportTransport } from '../src/services/reports';
import { bindNativeApp, type NativeAppApi } from '../src/config/native';
import { parentPath, resolveBack, setBackOverride } from '../src/app/backHandler';
import { AUTH_LOGIN_ENABLED } from '../src/config/auth';
import { statusKind } from '../src/lib/status';
import { parseStructuredLine } from '../src/shared/reportForm';
import { TERMS_VERSION, clearProfile, getProfile, saveProfile, tripSetupDone, validateProfile } from '../src/services/profile';
import { pending, type Trip } from '../src/data/models';
import type { Repository } from '../src/data/repository';
import type { LocationProvider } from '../src/services/location';
import { memoryRepository } from './support';

const gps = (): LocationProvider => ({ onFix: () => { }, onError: () => { }, onStatus: () => { }, preserveAll: true, requestPermission: vi.fn(async () => { }), start: vi.fn(async () => { }), stop: vi.fn(async () => { }) });
const repos = new Map<string, Repository>();
const repoFor = async (name: string) => { if (!repos.has(name)) repos.set(name, memoryRepository(name)); return repos.get(name)!; };
const newMonitor = (permissions?: MonitorPermissions, provider = gps()) => new Monitor(repoFor, () => provider, permissions);
const acceptTerms = () => localStorage.setItem('ifto_terms', JSON.stringify({ version: TERMS_VERSION, accepted_at: '2026-11-20T00:00:00Z' }));
const profile = { name: 'Maria Silva', email: 'maria@ifto.edu.br' };
beforeEach(() => { localStorage.clear(); repos.clear(); window.location.hash = '#/'; vi.restoreAllMocks(); });
const perms = (state: { loc: boolean; fg: boolean; notif: boolean; bat: boolean }) => {
    const mock = {
        checkPermissions: vi.fn(async () => ({ location: state.fg ? 'granted' : 'denied', backgroundLocation: state.loc ? 'granted' : 'denied', notification: state.notif ? 'granted' : 'denied' })),
        requestPermissions: vi.fn(async (o: { permissions?: string[] }) => { if (o.permissions?.includes('location')) state.fg = true; if (o.permissions?.includes('backgroundLocation')) state.loc = true; if (o.permissions?.includes('notification')) state.notif = true; return {}; }),
        openSettings: vi.fn(async () => { }),
    };
    const deps: PermissionDeps = { api: mock as unknown as PermissionDeps['api'], native: true, battery: async () => state.bat, requestBattery: vi.fn(async () => { state.bat = true; return true; }) };
    return { mock, deps, permissions: new MonitorPermissions(deps) };
};
const trip = (id = '11111111-2222-3333-4444-555555555555'): Trip => ({ id, vehicle_id: 'v', vehicle_label_snapshot: 'Ônibus 02', bus_label: 'Ônibus 02', route_name: 'Serrano', route_id: null, owner_user_id: null, operator_label: 'x', status: 'recording', started_at: new Date().toISOString(), ended_at: null, ended_reason: null, device_id: 'd', gps_interval_ms: 10000, events: [], created_at: '', updated_at: '', ...pending });

test('não existe mais modo Aluno/Monitor nem código: arquivos removidos e nada na interface', () => {
    for (const f of ['src/services/appMode.ts', 'src/app/ModeContext.tsx', 'src/config/monitorCode.ts']) expect(existsSync(f)).toBe(false);
    for (const f of ['src/app/App.tsx', 'src/screens/Screens.tsx', 'src/screens/Student.tsx', 'src/screens/Onboarding.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(/modo Aluno|modo Monitor|Entrar como monitor|código do monitor/i);
});
test('termos → cadastro → Início, uma única vez', async () => {
    const view = render(<Root makeMonitor={() => newMonitor()}/>);
    fireEvent.click(screen.getByLabelText('Li e concordo')); fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Maria Silva' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'invalido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText('Digite um e-mail válido.');
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'Maria@IFTO.edu.br' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Olá, Maria!' });
    expect(screen.getByRole('button', { name: 'Iniciar viagem' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Relatar problema' })).toBeTruthy();
    expect(getProfile()).toEqual(profile); expect(localStorage.getItem('ifto_terms')).toContain(TERMS_VERSION);
    expect(screen.queryByText('Entrar com e-mail')).toBeNull();
    view.unmount();
    render(<Root makeMonitor={() => newMonitor()}/>); // segunda abertura: direto no Início
    await screen.findByRole('heading', { name: 'Olá, Maria!' });
    expect(validateProfile('A', 'a@b.co')).toEqual({ error: 'Digite seu nome.' });
});
test('barra inferior: Início, Relatar, Histórico; Histórico tem Viagens, Meus relatos e Relatórios', async () => {
    acceptTerms(); saveProfile(profile);
    render(<Root makeMonitor={() => newMonitor()}/>);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['Início', 'Relatar', 'Histórico']);
    fireEvent.click(within(nav).getByRole('link', { name: 'Histórico' }));
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Viagens', 'Meus relatos', 'Relatórios']);
    fireEvent.click(screen.getByRole('tab', { name: 'Relatórios' }));
    await screen.findByRole('heading', { name: 'Pontualidade' });
});
test('permissões só no primeiro Iniciar viagem e só as pendentes depois', async () => {
    const state = { loc: false, fg: false, notif: false, bat: false }, { deps, mock, permissions } = perms(state);
    const m = newMonitor(permissions); await m.enter('field', 'Maria', true); await m.saveBusLabel('Ônibus 01');
    render(<App monitor={m}/>);
    expect(deps.requestBattery).not.toHaveBeenCalled(); expect(mock.requestPermissions).not.toHaveBeenCalled(); // abrir o app nunca pede permissão
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar viagem' })); // Início → tela da viagem
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar viagem' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir localização' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir avisos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Permitir uso contínuo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar viagem' }));
    await waitFor(() => expect(m.snapshot.active).toBeTruthy());
    expect(tripSetupDone()).toBe(true);
    expect(m.snapshot.active!.events!.find(e => e.type === 'trip_started')!.details).toEqual({ batteryExempt: true, locationAlways: true, notifications: true });
    await m.finish(); await m.dispose();
    // próxima viagem: só falta o uso contínuo → um único pedido, sem assistente
    state.bat = false; mock.requestPermissions.mockClear(); (deps.requestBattery as ReturnType<typeof vi.fn>).mockClear();
    const m2 = newMonitor(permissions); await m2.enter('field', 'Maria', true); await m2.saveBusLabel('Ônibus 01');
    await m2.start(m2.snapshot.vehicles[0].id);
    expect(deps.requestBattery).toHaveBeenCalledTimes(1); expect(mock.requestPermissions).not.toHaveBeenCalled();
    await m2.dispose();
});
test('durante a viagem: Relatar problema e Finalizar viagem visíveis; relato leva trip= e loc=', async () => {
    const sent: string[] = [];
    const transport: ReportTransport = { async send(r) { sent.push(r.message); } };
    const queue = new ReportQueue(new MemoryReportStore(), transport, () => true);
    const provider = gps();
    const m = newMonitor(undefined, provider); await m.enter('field', 'Maria', true); await m.saveBusLabel('Ônibus 02');
    await m.start(m.snapshot.vehicles.find(v => v.label === 'Ônibus 02')!.id);
    provider.onFix({ latitude: -10.167351, longitude: -48.869504, accuracy: 5, speed: 10, timestamp: Date.now() }); await m.service!.flush();
    const shortId = m.snapshot.active!.id.slice(0, 8);
    saveProfile(profile);
    render(<App monitor={m} queue={queue}/>);
    expect(screen.getByRole('button', { name: 'Finalizar viagem' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Viagem em andamento' }));
    expect(await screen.findByRole('button', { name: 'Finalizar viagem' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Relatar problema' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pneu furado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar relato' }));
    await screen.findByText('Relato enviado, obrigado!');
    const parsed = parseStructuredLine(sent[0])!;
    expect(sent[0]).toContain(`|trip=${shortId}|loc=-10.16735,-48.86950|`);
    expect(parsed).toMatchObject({ user: 'maria@ifto.edu.br', userName: 'Maria Silva', trip: shortId, bus: 'Ônibus 02', problems: ['pneu_furado'] });
    expect(screen.getByRole('button', { name: 'Voltar ao início' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Fazer outro relato' })).toBeTruthy();
    await m.dispose();
});
test('relato fora de viagem não leva trip= nem loc=', async () => {
    const sent: string[] = [];
    const queue = new ReportQueue(new MemoryReportStore(), { async send(r) { sent.push(r.message); } }, () => true);
    const m = newMonitor(); await m.enter('field', 'Maria', true);
    render(<App monitor={m} queue={queue}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Relatar problema' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ônibus 01' })); fireEvent.click(screen.getByRole('button', { name: 'Atrasou' })); fireEvent.click(screen.getByRole('button', { name: 'Enviar relato' }));
    await screen.findByText('Relato enviado, obrigado!');
    expect(sent[0]).not.toMatch(/trip=|loc=/);
    await m.dispose();
});
test('voltar do formulário: sem dados volta direto; com dados pergunta Descartar', async () => {
    const m = newMonitor(); await m.enter('field', 'Maria', true);
    render(<App monitor={m}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Relatar problema' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }));
    await screen.findByRole('button', { name: 'Iniciar viagem' });
    fireEvent.click(screen.getByRole('button', { name: 'Relatar problema' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Superlotado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Descartar este relato?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Continuar editando' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByText('1 marcados', { selector: '.qrCount' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Descartar' }));
    await screen.findByRole('button', { name: 'Iniciar viagem' });
    await m.dispose();
});
test('botão voltar do Android: rotas pai, tela que trata e minimizar no Início', async () => {
    expect(parentPath('/')).toBeNull(); expect(parentPath('/report')).toBe('/'); expect(parentPath('/history/abc')).toBe('/history'); expect(parentPath('/settings/routes')).toBe('/settings'); expect(parentPath('/consent')).toBe('/settings'); expect(parentPath('/trip')).toBe('/');
    expect(resolveBack('/')).toBe('minimize'); expect(resolveBack('/settings')).toBe('/');
    const off = setBackOverride(() => true); expect(resolveBack('/report')).toBe('handled'); off(); expect(resolveBack('/report')).toBe('/');
    let listener: (e: { canGoBack: boolean }) => void = () => { };
    const app: NativeAppApi = { addListener: (async (event: string, cb: never) => { if (event === 'backButton') listener = cb; return { remove: async () => { } }; }) as never, exitApp: vi.fn(async () => { }) };
    const onBack = vi.fn(); await bindNativeApp(app, () => true, async () => { }, onBack);
    listener({ canGoBack: true }); expect(onBack).toHaveBeenCalledTimes(1); expect(app.exitApp).not.toHaveBeenCalled();
});
test('voltar nativo no formulário com dados abre o Descartar', async () => {
    const m = newMonitor(); await m.enter('field', 'Maria', true);
    render(<App monitor={m}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Relatar problema' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sem cinto' }));
    act(() => { expect(resolveBack('/report')).toBe('handled'); });
    await screen.findByRole('dialog', { name: 'Descartar este relato?' });
    await m.dispose();
});
test('Trocar usuário apaga só o cadastro: viagens, relatos e termos ficam', async () => {
    acceptTerms(); saveProfile(profile);
    const m = newMonitor(); await m.enter('field', 'Maria', true);
    await (await repoFor('ifto_monitor')).put('trips', { ...trip('aaaaaaaa-0000-0000-0000-000000000000'), status: 'finished', ended_at: new Date().toISOString() });
    render(<Root makeMonitor={() => m}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Trocar usuário' }));
    await screen.findByRole('heading', { name: 'Cadastro rápido' });
    expect(getProfile()).toBeNull(); expect(localStorage.getItem('ifto_terms')).toContain(TERMS_VERSION);
    expect((await (await repoFor('ifto_monitor')).all('trips')).length).toBe(1);
    expect(screen.queryByText('Entrar com e-mail')).toBeNull();
    clearProfile();
});
test('migração: celular com viagens, modo antigo e termos 2.2 mantém os dados e só refaz termos e cadastro', async () => {
    localStorage.setItem('ifto_terms', JSON.stringify({ version: '2.2', accepted_at: '2026-11-19T00:00:00Z' })); localStorage.setItem('ifto_app_mode', 'monitor'); localStorage.setItem('ifto_mode', 'field');
    const old = { ...trip('bbbbbbbb-0000-0000-0000-000000000000'), status: 'finished' as const, ended_at: new Date().toISOString() };
    await (await repoFor('ifto_monitor')).put('trips', old);
    const m = newMonitor();
    render(<Root makeMonitor={() => m}/>);
    fireEvent.click(screen.getByLabelText('Li e concordo')); fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Joana' } }); fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'joana@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByRole('heading', { name: 'Olá, Joana!' });
    await waitFor(() => expect(m.snapshot.trips.map(t => t.id)).toContain(old.id));
    expect(screen.queryByText('Entrar com e-mail')).toBeNull(); expect(screen.queryByText('Modo demonstração')).toBeNull();
    await m.dispose();
});
test('viagem leva o usuário em extra.user; login antigo desativado', async () => {
    expect(AUTH_LOGIN_ENABLED).toBe(false);
    const { cloudPayload } = await import('../src/services/cloudSync');
    const t = { ...trip(), status: 'finished' as const, ended_at: new Date().toISOString(), user: { name: 'Maria Silva', email: 'maria@ifto.edu.br' } };
    expect((cloudPayload(t, [], []).trips[0].extra as { user: unknown }).user).toEqual({ name: 'Maria Silva', email: 'maria@ifto.edu.br' });
    const m = newMonitor(); m.user = { name: 'Maria', email: 'maria@ifto.edu.br' }; await m.enter('field', 'Maria', true); await m.saveBusLabel('Ônibus 01');
    await m.start(m.snapshot.vehicles[0].id);
    expect(m.snapshot.active!.user).toEqual({ name: 'Maria', email: 'maria@ifto.edu.br' });
    await m.dispose();
});
test('indicador de status por estado', () => {
    const base = { recording: false, locationDenied: false, syncError: false, syncPending: false };
    expect(statusKind(base)).toBe('idle'); expect(statusKind({ ...base, recording: true })).toBe('recording'); expect(statusKind({ ...base, syncPending: true })).toBe('pending');
    expect(statusKind({ ...base, syncError: true })).toBe('error'); expect(statusKind({ ...base, recording: true, locationDenied: true })).toBe('error'); expect(statusKind({ ...base, locationDenied: true })).toBe('idle');
});
