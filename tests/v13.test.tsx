import { test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { App } from '../src/app/App';
import { Stops } from '../src/screens/Screens';
import { TripMap, fitBounds } from '../src/components/TripMap';
import { Monitor } from '../src/services/monitor';
import { detectStops } from '../src/services/stops';
import { TripService } from '../src/services/trip';
import { initialize } from '../src/data/repository';
import { defaults, pending, type GpsPoint, type Stop } from '../src/data/models';
import { distance } from '../src/lib/geo';
import { memoryRepository } from './support';
// @ts-expect-error Helper JavaScript local.
import { configureGradle } from '../scripts/build-apk.mjs';
// @ts-expect-error Helper JavaScript local.
import { checkManifest } from '../scripts/check-android-manifest.mjs';
vi.mock('../src/config/auth', () => ({ AUTH_LOGIN_ENABLED: true }));
const point = (s: number, meters = 0, speed = 0, accuracy = 5): GpsPoint => ({ id: String(s), trip_id: 't', seq: s, latitude: 0, longitude: meters / 111194.9266, accuracy_m: accuracy, speed_mps: speed, recorded_at: new Date(s * 1000).toISOString(), received_at: new Date(s * 1000).toISOString(), device_id: 'd', source: 'demo', accepted: true, ...pending });
const stationary = (start: number, meters = 0) => [0,10,20,30,40].map(t => point(start+t, meters));
test('300 m a 1,2 m/s e pausa de 40 s: uma parada e distância coerente', () => {
 const points = [...Array.from({length:26}, (_,i)=>point(i*5,i*6,1.2)), ...[0,10,20,30,40].map(t=>point(130+t,150)), ...Array.from({length:26},(_,i)=>point(175+i*5,150+i*6,1.2))];
 const stops=detectStops(points,defaults); expect(stops).toHaveLength(1); expect(stops[0].duration_s).toBeGreaterThanOrEqual(35); expect(stops[0].duration_s).toBeLessThanOrEqual(45); expect(distance(points)).toBeGreaterThan(270);expect(distance(points)).toBeLessThan(330);
});
test('ruído de +/-8 m não divide parada de 40 s',()=>{const stops=detectStops(stationary(0).map((p,i)=>({...p,longitude:(i%2?8:-8)/111194.9266})),defaults);expect(stops).toHaveLength(1);expect(stops[0].duration_s).toBe(40);});
test('duas paradas separadas por 150 m',()=>expect(detectStops([...stationary(0),point(50,60,5),point(60,120,5),...stationary(70,150)],defaults)).toHaveLength(2));
test('precisão acima de 50 m ignorada mesmo com accepted true',()=>expect(detectStops(stationary(0).map(p=>({...p,accuracy_m:51})),defaults)).toHaveLength(0));
test('buraco de 70 s no mesmo local preserva uma parada',()=>{const stops=detectStops([...stationary(0),...stationary(110)],defaults);expect(stops).toHaveLength(1);expect(stops[0].duration_s).toBe(150);});
test('buraco de 70 s em outro local separa paradas',()=>expect(detectStops([...stationary(0),...stationary(110,150)],defaults)).toHaveLength(2));
test('manuais usam ponto mais proximo, ficam abertas com duracao positiva e bloqueiam repeticao',async()=>{
 const repo=memoryRepository();await initialize(repo); const gps={onFix:()=>{},onError:()=>{},onStatus:()=>{},requestPermission:async()=>{},start:async()=>{},stop:async()=>{}};
 const service=new TripService(repo,'demo',gps,defaults);const trip=await service.start((await repo.all('vehicles'))[0].id);const now=Date.now();
 await repo.put('gps_points',{...point(0),id:'near',trip_id:trip.id,recorded_at:new Date(now-1000).toISOString()});await repo.put('gps_points',{...point(1,200),id:'future',trip_id:trip.id,recorded_at:new Date(now+60000).toISOString()});
 await service.manualStop();await service.manualStop();let stops=await repo.all('stops');expect(stops).toHaveLength(1);expect(stops[0]).toMatchObject({duration_s:1,departed_at:null,longitude:0});
 vi.spyOn(Date,'now').mockReturnValue(now+6000);await service.manualStop();stops=await repo.all('stops');expect(stops).toHaveLength(1);vi.restoreAllMocks();await service.dispose();
});
for (const [status, labels] of [['candidata',['Confirmar','Descartar','Renomear']],['confirmada',['Voltar para candidata','Renomear']],['descartada',['Restaurar']]] as const) test('ações da parada '+status,async()=>{
 const m=new Monitor();const stop:Stop={id:'s',trip_id:'t',arrived_at:new Date().toISOString(),departed_at:null,duration_s:40,latitude:0,longitude:0,avg_accuracy_m:5,status,label:'Parada',detected_by:'auto',created_at:'',updated_at:'',...pending};m.patch({stops:[stop]});const edit=vi.spyOn(m,'editStop').mockResolvedValue();render(<Stops monitor={m} tripId="t"/>);expect(screen.getAllByRole('button').map(b=>b.textContent)).toEqual([...labels]);fireEvent.click(screen.getByRole('button',{name:status==='candidata'?'Confirmar':status==='confirmada'?'Voltar para candidata':'Restaurar'}));await waitFor(()=>expect(edit).toHaveBeenCalledWith('s',{status:status==='candidata'?'confirmada':'candidata'}));
});
test('safe-area centralizada inclui cabeçalho, login e todas as rotas',async()=>{
 localStorage.clear();window.location.hash='/';const m=new Monitor(async name=>memoryRepository(name));const view=render(<App monitor={m}/>);await waitFor(()=>expect(m.snapshot.busy).toBe(false));expect(within(screen.getByTestId('page-layout')).getByRole('heading',{name:'IFTO Monitor'})).toBeTruthy();expect(within(screen.getByTestId('page-layout')).getByRole('heading',{name:'Entrar com e-mail'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Modo campo local'}));expect(within(screen.getByTestId('page-layout')).getByRole('heading',{name:'Termo de ciência'})).toBeTruthy();await act(async()=>{await m.enter('demo');});
 for(const [path,title] of [['/','Olá!'],['/trip','Viagem'],['/history','Histórico'],['/history/missing','Detalhe da viagem'],['/settings','Ajustes'],['/consent','Termo de ciência']]){window.location.hash=path;await waitFor(()=>expect(within(screen.getByTestId('page-layout')).getByRole('heading',{name:title})).toBeTruthy());expect([...view.container.querySelectorAll('h1,h2,header')].every(el=>el.closest('.pageLayout'))).toBe(true);}
 const css=readFileSync('src/style.css','utf8');expect(css).toContain('padding-top:max(env(safe-area-inset-top), 12px)');expect(css).toContain('padding-bottom:calc(96px + env(safe-area-inset-bottom))');expect(readFileSync('index.html','utf8')).toContain('viewport-fit=cover');
});
test('nuvem ausente: aviso informativo fecha e expira em 8 s',async()=>{
 localStorage.clear();window.location.hash='/';const m=new Monitor(async name=>memoryRepository(name));render(<App monitor={m}/>);await waitFor(()=>expect(m.snapshot.busy).toBe(false));await act(async()=>{await m.enter('demo');});await screen.findByRole('heading',{name:'Olá!'});await act(async()=>{await m.sync(true);});expect(screen.getByRole('button',{name:'Fechar aviso'})).toBeTruthy();expect(m.snapshot.error).toBe('');fireEvent.click(screen.getByRole('button',{name:'Fechar aviso'}));expect(m.snapshot.notice).toBe('');vi.useFakeTimers();try { await act(async()=>{await m.sync(true);});await act(async()=>{await vi.advanceTimersByTimeAsync(8000);});expect(m.snapshot.notice).toBe('');} finally {vi.useRealTimers();}
});
test('Campo local mostra registros salvos e botão de nuvem desabilitado',async()=>{
 const m=new Monitor();m.patch({mode:'field'});const {Home}=await import('../src/screens/Screens');const {MemoryRouter}=await import('react-router-dom');render(<MemoryRouter><Home monitor={m}/></MemoryRouter>);expect(screen.getByText('Registros salvos no aparelho')).toBeTruthy();expect((screen.getByRole('button',{name:'Nuvem não configurada'}) as HTMLButtonElement).disabled).toBe(true);
});
test('mapa curto zoom 17, enquadramento máximo 18, linha e fallback',()=>{
 expect(fitBounds(0,0,true)).toBe(17);expect(fitBounds(.000001,.000001,false)).toBe(18);const view=render(<TripMap points={[point(0),point(10,20)]} stops={[]} online={false}/>);expect(view.container.querySelector('polyline')?.getAttribute('stroke')).toBe('var(--color-primary)');expect(view.container.querySelectorAll('circle')).toHaveLength(2);expect(screen.getByText('Coordenadas do trajeto')).toBeTruthy();expect(view.container.querySelectorAll('li')).toHaveLength(2);
});
test('Gradle idempotente substitui chaves duplicadas e mantém AndroidX',()=>{const once=configureGradle('android.useAndroidX=true\norg.gradle.jvmargs=-Xmx1m\norg.gradle.jvmargs=-Xmx2m\n');expect(configureGradle(once)).toBe(once);expect(once.match(/org.gradle.jvmargs=/g)).toHaveLength(1);expect(once).toContain('-Xmx1536m');expect(once).toContain('org.gradle.workers.max=2');expect(once).toContain('android.useAndroidX=true');});
test('manifesto falha quando qualquer permissão é removida e mantém GPS',()=>{const xml=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');expect(checkManifest(xml)).toBe(true);for(const name of ['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION'])expect(()=>checkManifest(xml.replace('android.permission.'+name,'removed'))).toThrow(name);expect(xml).toContain('android.hardware.location.gps');});
