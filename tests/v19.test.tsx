import { test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Monitor } from '../src/services/monitor';
import { RecordingReadiness } from '../src/components/RecordingReadiness';
import { TripScreen } from '../src/screens/Screens';
import { App } from '../src/app/App';
import type { GpsDiagnostics, LocationProvider } from '../src/services/location';
import { memoryRepository } from './support';
import { t } from '../src/i18n/pt-BR';
const ready: GpsDiagnostics = { provider:'background',foreground:'granted',background:'granted',notification:'granted',backgroundActive:true };
afterEach(()=>{vi.restoreAllMocks();localStorage.clear();window.location.hash='/';});
async function setup(d: GpsDiagnostics = ready, battery = true) {
    let current = d;
    const provider: LocationProvider = {onFix:()=>{},onError:()=>{},onStatus:()=>{},requestPermission:vi.fn(async()=>{}),start:async()=>{},stop:async()=>{},openSettings:vi.fn(async()=>{}),checkDiagnostics:vi.fn(async()=>provider.onDiagnostics?.(current))};
    const m = new Monitor(async()=>memoryRepository(),()=>provider);
    await m.enter('demo'); m.patch({mode:'field',busLabel:'Ônibus 01',batteryConfirmed:battery,gpsDiagnostics:d});
    return {m,provider,setDiagnostics:(next:GpsDiagnostics)=>{current=next;}};
}
test.each([
    ['ready',ready,true,t.recordingReady,'gpsActive'],
    ['foreground',{...ready,background:'denied',backgroundActive:false},true,t.recordingForeground,'gpsWarning'],
    ['attention',ready,false,t.recordingBattery,'gpsWarning'],
    ['denied',{...ready,foreground:'denied',backgroundActive:false},true,t.recordingDenied,'error'],
] as const)('faixa %s tem mensagem, ícone e privacidade; iniciar permanece disponível',async(state,d,battery,message,css)=>{
    const {m}=await setup({...d},battery);render(<MemoryRouter><TripScreen monitor={m}/></MemoryRouter>);
    expect(m.recordingReadiness).toBe(state);expect(screen.getByText(message)).toBeTruthy();
    const privacy=screen.getByText(t.recordingPrivacy);expect(privacy.closest('aside')?.classList.contains(css)).toBe(true);expect(privacy.closest('aside')?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect((screen.getByRole('button',{name:t.start}) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/A localização é necessária para registrar o percurso durante uma viagem/)).toBeNull();await m.dispose();
});
test('notificações bloqueadas explicam ajuste e abrem guia existente',async()=>{
    const {m}=await setup({...ready,notification:'denied',backgroundActive:false});
    render(<MemoryRouter><RecordingReadiness monitor={m}/></MemoryRouter>);expect(screen.getByText(t.recordingNotifications)).toBeTruthy();expect(screen.getByText(t.recordingPrivacy)).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:t.recordingGuide}));await m.dispose();
});
test('durante o uso abre configurações; negada solicita permissão e atualiza diagnóstico',async()=>{
    const {m,provider,setDiagnostics}=await setup({...ready,background:'denied',backgroundActive:false});
    const view=render(<MemoryRouter><RecordingReadiness monitor={m}/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:t.recordingSettings}));await waitFor(()=>expect(provider.openSettings).toHaveBeenCalledTimes(1));
    view.unmount();m.patch({gps:'denied',gpsDiagnostics:{...ready,foreground:'denied',backgroundActive:false}});setDiagnostics(ready);
    // Keep denial on mount; granting happens only after the permission action.
    setDiagnostics({...ready,foreground:'denied',backgroundActive:false});
    render(<MemoryRouter><RecordingReadiness monitor={m}/></MemoryRouter>);await screen.findByText(t.recordingDenied);setDiagnostics(ready);fireEvent.click(screen.getByRole('button',{name:t.recordingAllow}));await screen.findByText(t.recordingReady);expect(provider.requestPermission).toHaveBeenCalledTimes(1);await m.dispose();
});
test('ao abrir e voltar do segundo plano reaproveita reconnectNative e reavalia permissões',async()=>{
    const {m,provider,setDiagnostics}=await setup({...ready,background:'denied',backgroundActive:false});
    vi.spyOn(m,'restore').mockResolvedValue(undefined);const resume=vi.spyOn(m,'reconnectNative');window.location.hash='/trip';
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
    render(<App monitor={m}/>);await screen.findByText(t.recordingForeground);expect(provider.checkDiagnostics).toHaveBeenCalled();
    setDiagnostics(ready);fireEvent(document,new Event('visibilitychange'));await screen.findByText(t.recordingReady);expect(resume).toHaveBeenCalled();expect(screen.getByText(t.recordingPrivacy)).toBeTruthy();
    setDiagnostics({...ready,background:'denied',backgroundActive:false});fireEvent(document,new Event('visibilitychange'));await screen.findByText(t.recordingForeground);expect(screen.queryByText(t.recordingReady)).toBeNull();
});
test('falha ao consultar permissões invalida verde anterior',async()=>{
    const {m,provider}=await setup();provider.checkDiagnostics=async()=>{throw new Error('indisponível');};
    render(<MemoryRouter><RecordingReadiness monitor={m}/></MemoryRouter>);await waitFor(()=>expect(m.recordingReadiness).toBe('attention'));expect(screen.queryByText(t.recordingReady)).toBeNull();expect(screen.getByText(t.recordingPrivacy)).toBeTruthy();await m.dispose();
});
