import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Monitor } from '../services/monitor';
import type { Trip } from '../data/models';

export function RoutePicker({ monitor: m, value, onChange }: { monitor: Monitor; value: string | null; onChange: (id: string | null) => void }) {
    const [other, setOther] = useState(false), [name, setName] = useState('');
    return <fieldset className="card"><legend>Rota</legend><div className="row">
        <button type="button" className={value === null ? 'selected' : 'secondary'} aria-pressed={value === null} onClick={() => onChange(null)}>Sem rota definida</button>
        {m.snapshot.routes.filter(r => r.active).map(r => <button type="button" key={r.id} className={value === r.id ? 'selected' : 'secondary'} aria-pressed={value === r.id} onClick={() => onChange(r.id)}>{r.name}</button>)}
        <button type="button" className="secondary" onClick={() => setOther(true)}>Outra rota…</button>
    </div>{!value && <p className="muted">Você pode definir a rota depois no Histórico</p>}
    {other && <form onSubmit={e => { e.preventDefault(); void m.run(async () => { const route = await m.addRoute(name); onChange(route.id); setOther(false); setName(''); }); }}>
        <label>Nome da rota<input value={name} minLength={2} maxLength={60} required onChange={e => setName(e.target.value)}/></label>
        <button disabled={m.snapshot.busy}>Criar rota</button><button type="button" className="link" onClick={() => setOther(false)}>Cancelar criação</button>
    </form>}</fieldset>;
}
export function TripRouteEditor({ monitor: m, trip }: { monitor: Monitor; trip: Trip }) {
    const [editing, setEditing] = useState(false), [value, setValue] = useState<string | null>(trip.route_id || null);
    return <section><button className="secondary" disabled={m.snapshot.busy} onClick={() => { setValue(trip.route_id || null); setEditing(true); }}>Editar rota</button>
        {editing && <section className="card" aria-label="Editar rota da viagem"><RoutePicker monitor={m} value={value} onChange={setValue}/>
            <button disabled={m.snapshot.busy} onClick={() => void m.run(async () => { await m.setTripRoute(trip.id, value); setEditing(false); })}>Salvar rota</button>
            <button className="link" onClick={() => setEditing(false)}>Cancelar</button>
        </section>}
    </section>;
}
export function RoutesSettings({ monitor: m }: { monitor: Monitor }) {
    const navigate = useNavigate(); const [name, setName] = useState('');
    const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
    return <><button className="link" onClick={() => navigate('/settings')}>Voltar</button><h2>Rotas</h2>
        <form className="card" onSubmit={e => { e.preventDefault(); void m.run(async () => { await m.addRoute(name); setName(''); }); }}>
            <label>Nome da nova rota<input minLength={2} maxLength={60} required value={name} onChange={e => setName(e.target.value)}/></label><button disabled={m.snapshot.busy}>Adicionar rota</button>
        </form>
        {m.snapshot.routes.map(r => <article className="card" key={r.id}><h3>{r.name}</h3><span className="badge">{r.active ? 'Ativa' : 'Desativada'}</span><div className="row">
            <button className="secondary" aria-label={'Renomear ' + r.name} onClick={() => setEditing({ id: r.id, name: r.name })}>Renomear</button>
            <button className="secondary" disabled={m.snapshot.busy} aria-label={(r.active ? 'Desativar ' : 'Ativar ') + r.name} onClick={() => void m.run(() => m.setRouteActive(r.id, !r.active))}>{r.active ? 'Desativar' : 'Ativar'}</button>
        </div>{editing?.id === r.id && <form onSubmit={e => { e.preventDefault(); void m.run(async () => { await m.renameRoute(r.id, editing.name); setEditing(null); }); }}><label>Novo nome da rota<input minLength={2} maxLength={60} required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}/></label><button disabled={m.snapshot.busy}>Salvar nome</button><button type="button" className="link" onClick={() => setEditing(null)}>Cancelar</button></form>}</article>)}
        <p className="muted">As rotas são desativadas, sem excluir viagens do histórico. Renomear corrige o nome em todas as viagens vinculadas.</p>
    </>;
}
