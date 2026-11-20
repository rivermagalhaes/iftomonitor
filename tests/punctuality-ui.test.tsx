import { afterEach, expect, test, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/app/App';
import { Monitor } from '../src/services/monitor';
import { memoryRepository } from './support';
import { defaultReference } from '../src/config/reference';
import type { LocationProvider } from '../src/services/location';

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); window.location.hash = '/'; });
function setup() {
    const gps: LocationProvider = { onFix: () => { }, onError: () => { }, onStatus: () => { }, requestPermission: async () => { }, start: async () => { }, stop: async () => { } };
    const repos = new Map<string, ReturnType<typeof memoryRepository>>();
    const monitor = new Monitor(async name => { if (!repos.has(name)) repos.set(name, memoryRepository(name)); return repos.get(name)!; }, () => gps);
    return { monitor, repos };
}

test('tela Pontualidade: estado vazio, abas e acesso pela navegação', async () => {
    const { monitor } = setup();
    render(<App monitor={monitor}/>);
    await waitFor(() => expect(monitor.snapshot.busy).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Modo demonstração' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Pontualidade' }));
    expect(await screen.findByRole('heading', { name: 'Pontualidade' })).toBeTruthy();
    expect(screen.getByText('Nenhuma viagem válida no período. Escolha a rota e finalize viagens no horário de turno.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tabela observada' }));
    expect(screen.getByText(/Horários que o ônibus de fato cumpre/)).toBeTruthy();
});

test('referências: salvar, rejeitar inválido e restaurar padrões (persistência no app_meta)', async () => {
    const { monitor, repos } = setup();
    await monitor.enter('demo');
    expect(monitor.snapshot.reference).toEqual(defaultReference);
    const edited = { ...defaultReference, campus: { ...defaultReference.campus, radiusM: 200 } };
    await monitor.saveReference(edited);
    expect(monitor.snapshot.reference.campus.radiusM).toBe(200);
    expect(JSON.parse((await repos.get('ifto_monitor_demo')!.get('app_meta', 'reference'))!.value).campus.radiusM).toBe(200);
    await expect(monitor.saveReference({ ...defaultReference, campus: { ...defaultReference.campus, radiusM: 10 } })).rejects.toThrow('raio');
    expect(monitor.snapshot.reference.campus.radiusM).toBe(200);
    await monitor.enter('demo'); // reabrir: carrega do banco
    expect(monitor.snapshot.reference.campus.radiusM).toBe(200);
    render(<App monitor={monitor}/>);
    window.location.hash = '/settings';
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar padrões' }));
    await waitFor(() => expect(monitor.snapshot.reference).toEqual(defaultReference));
});

test('turno por viagem: override persistido sem apagar dados; aviso de viagem sem rota ao finalizar', async () => {
    const { monitor } = setup();
    await monitor.enter('demo');
    await monitor.saveBusLabel('Ônibus 1');
    await monitor.start('', undefined, null);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App monitor={monitor}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar viagem' }));
    await screen.findByText(/Viagem sem rota não entra no relatório de pontualidade/);
    expect(screen.getByRole('button', { name: 'Ir para a viagem' })).toBeTruthy();
    const trip = monitor.snapshot.trips[0];
    expect(trip.status).toBe('finished'); expect(trip.shift_override).toBeUndefined();
    await act(async () => { await monitor.setTripShift(trip.id, 'ignorar'); });
    expect(monitor.snapshot.trips[0].shift_override).toBe('ignorar');
    expect(monitor.snapshot.trips[0].started_at).toBe(trip.started_at);
    await screen.findByRole('button', { name: 'Ignorar' });
});
