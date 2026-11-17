import { test, expect, vi } from 'vitest';
import { detectStops } from '../src/services/stops';
import { defaults, pending, type GpsPoint } from '../src/data/models';
import { ForegroundProvider, SimulatedProvider, locationError, type GeolocationApi } from '../src/services/location';
import { downloadFile } from '../src/services/export';
import { bindNativeApp } from '../src/config/native';
import { observeNetwork } from '../src/services/network';
import { t } from '../src/i18n/pt-BR';
function point(seconds: number, i = 0): GpsPoint { return { id:String(seconds), trip_id:'t', seq:i+1, latitude:-10.175, longitude:-48.884 + (i%2 ? 1 : -1)*(3+i%8)/111000, accuracy_m:10+i%21, speed_mps:null, recorded_at:new Date(seconds*1000).toISOString(), received_at:'',device_id:'d',source:'gps',accepted:true,...pending }; }
test('campo: cinco minutos, cadência 18s, jitter 3–10m e rejeitados mantêm uma parada', () => {
 const points=Array.from({length:18},(_,i)=>point(Math.min(300,i*18),i));
 points.splice(8,0,{...point(135,8), accepted:false,accuracy_m:100});
 const stops=detectStops(points,defaults); expect(stops).toHaveLength(1);expect(stops[0].duration_s).toBe(300);
});
test('não cria parada aos 6s nem com mínimo configurado abaixo de 15s',()=> expect(detectStops([point(0),point(6)],{...defaults,stopMinDurationS:1})).toHaveLength(0));
test('lacuna acompanha três intervalos, mínimo 60s',()=> { const stops=detectStops([point(0),point(40),point(80)],{...defaults,gpsIntervalMs:30000,maxGapS:30});expect(stops).toHaveLength(1);expect(stops[0].duration_s).toBe(80); });
test('segmentos consecutivos no mesmo local são mesclados',()=> {const points=[point(0),point(18),{...point(25),speed_mps:5},{...point(30),speed_mps:5},point(36),point(54)];expect(detectStops(points,defaults)).toHaveLength(1);expect(detectStops(points,defaults)[0].duration_s).toBe(54);});
test('GPS aceita limiar 0,9 e configura intervalo nativo sem cache',async()=> {
 let callback: Parameters<GeolocationApi['watchPosition']>[1] = ()=>{};
 const watch=vi.fn<GeolocationApi['watchPosition']>(async(options,cb)=>{callback=cb;return 'watch';});
 const api:GeolocationApi={checkPermissions:async()=>({location:'granted'}),requestPermissions:vi.fn(),watchPosition:watch,clearWatch:vi.fn(async()=>{})};
 const provider=new ForegroundProvider(api);const fixes=vi.fn();provider.onFix=fixes;await provider.requestPermission();await provider.start(defaults);
 for(const timestamp of [10000,18000,19000,28000]) callback({timestamp,coords:{latitude:-10,longitude:-48,accuracy:20,speed:0}});
 expect(fixes).toHaveBeenCalledTimes(3);expect(api.requestPermissions).not.toHaveBeenCalled();expect(watch.mock.calls[0][0]).toMatchObject({enableHighAccuracy:true,maximumAge:0,interval:10000,minimumUpdateInterval:9000});await provider.stop();expect(api.clearWatch).toHaveBeenCalledWith({id:'watch'});
});
test('permissão permanente e GPS desligado preservam orientação específica',async()=>{const api:GeolocationApi={checkPermissions:async()=>({location:'denied'}), requestPermissions:vi.fn(),watchPosition:vi.fn(),clearWatch:vi.fn()};await expect(new ForegroundProvider(api).requestPermission()).rejects.toThrow(t.permissionPermanent);expect(api.requestPermissions).not.toHaveBeenCalled();expect(locationError({code:'OS-PLUG-GLOC-0007'})).toBe(t.gpsDisabled);});
test('demo produz paradas automaticamente pelo detector real',async()=> {vi.useFakeTimers();try{const provider=new SimulatedProvider();const points:GpsPoint[]=[];provider.onFix=fix=>points.push({...point(fix.timestamp/1000,points.length),latitude:fix.latitude,longitude:fix.longitude,speed_mps:fix.speed,accuracy_m:fix.accuracy});await provider.start(defaults);await vi.advanceTimersByTimeAsync(45000);await provider.stop();expect(detectStops(points,defaults).length).toBeGreaterThan(0);}finally{vi.useRealTimers();}});
test('exportação usa URI e nome e preserva erro real',async()=> {const share=vi.fn(async()=>{}),writeFile=vi.fn(async()=>({uri:'file:///cache/test.csv'}));await downloadFile('test.csv','\uFEFFa','text/csv',{writeFile,share});expect(share).toHaveBeenCalledWith({files:['file:///cache/test.csv'],title:'test.csv',dialogTitle:'test.csv'});await expect(downloadFile('a','b','text/plain',{writeFile:async()=>{throw new Error('Sem espaço');},share})).rejects.toThrow('Sem espaço');});
test('rede nativa atualiza indicador e remove listener',async()=> {const remove=vi.fn(async()=>{}),listener=vi.fn();const cleanup=await observeNetwork(listener,{getStatus:async()=>({connected:false}),addListener:async(_name,cb)=>{cb({connected:true});return {remove};}});expect(listener.mock.calls).toEqual([[false],[true]]);cleanup();expect(remove).toHaveBeenCalled();});
test('voltar não fecha gravação sem confirmação',async()=>{let back: (e:{canGoBack:boolean})=>void=()=>{};const exitApp=vi.fn(async()=>{});const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);const cleanup=await bindNativeApp({addListener:async(name,cb)=>{if(name==='backButton')back=cb as typeof back;return {remove:async()=>{}};},exitApp},()=>true,async()=>{});back({canGoBack:false});expect(exitApp).not.toHaveBeenCalled();confirm.mockReturnValue(true);back({canGoBack:false});expect(exitApp).toHaveBeenCalledTimes(1);await cleanup();confirm.mockRestore();});

test('pendentes do banco demo são zero',async()=>{const {memoryRepository}=await import('./support');const {initialize,counts}=await import('../src/data/repository');const repo=memoryRepository();await initialize(repo);expect((await counts(repo)).pending).toBe(0);});
