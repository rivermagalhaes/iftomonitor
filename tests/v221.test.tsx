import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App, Root } from '../src/app/App';
import { Monitor } from '../src/services/monitor';
import { SettingsScreen } from '../src/screens/Screens';
import { StudentSettings } from '../src/screens/Student';
import { ModeContext } from '../src/app/ModeContext';
import { AUTH_LOGIN_ENABLED } from '../src/config/auth';
import { statusKind } from '../src/lib/status';
import { TERMS_VERSION } from '../src/services/appMode';
import { memoryRepository } from './support';
import type { LocationProvider } from '../src/services/location';

const gps = (): LocationProvider => ({ onFix: () => { }, onError: () => { }, onStatus: () => { }, preserveAll: true, requestPermission: vi.fn(async () => { }), start: vi.fn(async () => { }), stop: vi.fn(async () => { }) });
const newMonitor = (provider = gps()) => new Monitor(async name => memoryRepository(name), () => provider);
const seed = (mode: 'aluno' | 'monitor') => { localStorage.clear(); localStorage.setItem('ifto_terms', JSON.stringify({ version: TERMS_VERSION, accepted_at: '2026-11-20T00:00:00Z' })); localStorage.setItem('ifto_app_mode', mode); localStorage.setItem('ifto_monitor_setup_done', '1'); window.location.hash = '#/'; };
beforeEach(() => { vi.restoreAllMocks(); });

test('login por e-mail/Google e demonstração estão desativados e nenhum caminho leva a eles', async () => {
    expect(AUTH_LOGIN_ENABLED).toBe(false);
    const m = newMonitor();
    render(<App monitor={m}/>);
    await waitFor(() => expect(m.snapshot.mode).toBe('field'));
    expect(screen.queryByText('Entrar com e-mail')).toBeNull();
    expect(screen.queryByText('Continuar com Google')).toBeNull();
    expect(screen.queryByText('Modo demonstração')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes' }));
    await screen.findByRole('button', { name: 'Mudar para modo Aluno' });
    expect(screen.queryByText('Trocar modo de operação')).toBeNull();
    expect(screen.queryByText('Entrar com e-mail')).toBeNull();
    await m.dispose();
});
test('indicador de status por estado', () => {
    const base = { recording: false, locationDenied: false, syncError: false, syncPending: false };
    expect(statusKind(base)).toBe('idle');
    expect(statusKind({ ...base, recording: true })).toBe('recording');
    expect(statusKind({ ...base, syncPending: true })).toBe('pending');
    expect(statusKind({ ...base, recording: true, syncPending: true })).toBe('recording');
    expect(statusKind({ ...base, syncError: true })).toBe('error');
    expect(statusKind({ ...base, recording: true, locationDenied: true })).toBe('error');
    expect(statusKind({ ...base, locationDenied: true })).toBe('idle'); // sem viagem, permissão negada não é erro
});
test('Configurações do monitor: botão Mudar para modo Aluno confirma e troca; viagem em andamento bloqueia', async () => {
    const m = newMonitor(); await m.enter('field', 'AB', true);
    const switchTo = vi.fn();
    const view = render(<ModeContext.Provider value={{ mode: 'monitor', switchTo }}><MemoryRouter><SettingsScreen monitor={m}/></MemoryRouter></ModeContext.Provider>);
    const button = screen.getByRole('button', { name: 'Mudar para modo Aluno' });
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(button); expect(switchTo).not.toHaveBeenCalled();
    fireEvent.click(button); expect(ask).toHaveBeenLastCalledWith('Mudar para modo Aluno? Você poderá voltar com o código do monitor.'); expect(switchTo).toHaveBeenCalledWith('aluno');
    switchTo.mockClear(); ask.mockClear();
    m.patch({ active: { id: 't' } as never });
    fireEvent.click(button);
    expect(ask).not.toHaveBeenCalled(); expect(switchTo).not.toHaveBeenCalled();
    expect(m.snapshot.error).toBe('Finalize a viagem antes de mudar de modo.');
    view.unmount(); await m.dispose();
});
test('Configurações do aluno: versão, termos e Entrar como monitor exige o código', async () => {
    const switchTo = vi.fn();
    render(<ModeContext.Provider value={{ mode: 'aluno', switchTo }}><MemoryRouter><StudentSettings/></MemoryRouter></ModeContext.Provider>);
    expect(screen.getByText(/Versão do app: 2\.2\.1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver termos de uso' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    fireEvent.change(screen.getByLabelText('Código do monitor'), { target: { value: 'errado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    await screen.findByText('Código incorreto. Você continua no modo Aluno.');
    expect(switchTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    fireEvent.change(screen.getByLabelText('Código do monitor'), { target: { value: 'IFTO2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar como monitor' }));
    await waitFor(() => expect(switchTo).toHaveBeenCalledWith('monitor'));
});
test('barra inferior por modo e troca Monitor → Aluno sem reiniciar, sem GPS', async () => {
    seed('monitor');
    const provider = gps();
    render(<Root makeMonitor={() => newMonitor(provider)}/>);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['Início', 'Viagem', 'Histórico', 'Pontualidade']);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajustes' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Mudar para modo Aluno' }));
    await waitFor(() => expect(within(screen.getByRole('navigation')).getAllByRole('link').map(a => a.textContent)).toEqual(['Relatar', 'Meus relatos']));
    expect(localStorage.getItem('ifto_app_mode')).toBe('aluno');
    expect(localStorage.getItem('ifto_terms')).toBeTruthy();
    expect(provider.start).not.toHaveBeenCalled();
    expect(screen.getByText(/Emergência agora|Ônibus e rota/)).toBeTruthy();
});
test('modo Aluno: só Relatar e Meus relatos, com engrenagem para Configurações', async () => {
    seed('aluno');
    render(<Root/>);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['Relatar', 'Meus relatos']);
    expect(screen.getByRole('link', { name: 'Ajustes' })).toBeTruthy();
});
test('velocímetro aparece na tela Viagem durante a viagem, com máxima e faixa', async () => {
    const { TripScreen } = await import('../src/screens/Screens');
    const m = newMonitor(); await m.enter('field', 'AB', true); await m.saveBusLabel('Ônibus 01');
    const now = Date.now();
    const point = (i: number, kmh: number) => ({ id: 'p' + i, trip_id: 't', seq: i, latitude: -10, longitude: -48, accuracy_m: 5, speed_mps: kmh / 3.6, recorded_at: new Date(now - (3 - i) * 5000).toISOString(), received_at: '', device_id: 'd', source: 'gps', accepted: true }) as never;
    const trip = { id: 't', vehicle_id: 'v', vehicle_label_snapshot: 'Ônibus 01', bus_label: 'Ônibus 01', route_name: '', route_id: null, status: 'recording', started_at: new Date(now - 60000).toISOString(), ended_at: null, gps_interval_ms: 10000, events: [] } as never;
    m.patch({ active: trip, points: [point(0, 90), point(1, 104), point(2, 108)] });
    render(<MemoryRouter><TripScreen monitor={m}/></MemoryRouter>);
    const gauge = screen.getByLabelText('Velocímetro');
    expect(gauge.className).toContain('high');
    expect(within(gauge).getByText('Velocidade alta', { exact: false })).toBeTruthy();
    expect(within(gauge).getByText('Máx. na viagem: 108 km/h')).toBeTruthy();
    await m.dispose();
});
