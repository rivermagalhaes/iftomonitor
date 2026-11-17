import type { Repository } from '../data/repository';
import { pending, type Route, type Trip } from '../data/models';
export type TripWriter = (id: string, update: (trip: Trip) => Trip) => Promise<Trip>;
export const routeKey = (name: string) => name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
export class RouteService {
    constructor(private repo: Repository, private write: TripWriter = async (id, update) => {
        const current = await repo.get('trips', id);
        if (!current) throw new Error('Viagem não encontrada.');
        const next = update(current); await repo.put('trips', next); return next;
    }) {}
    private async name(value: string, except?: string) {
        const name = value.trim().replace(/\s+/g, ' ');
        if (Array.from(name).length < 2 || Array.from(name).length > 60) throw new Error('O nome da rota deve ter de 2 a 60 caracteres.');
        if ((await this.repo.all('routes')).some(r => r.id !== except && routeKey(r.name) === routeKey(name))) throw new Error('Já existe uma rota com esse nome. Se estiver desativada, ative-a em Ajustes > Rotas.');
        return name;
    }
    async create(value: string): Promise<Route> {
        const name = await this.name(value), now = new Date().toISOString();
        const route: Route = { id: crypto.randomUUID(), name, active: true, created_at: now, updated_at: now, ...pending };
        await this.repo.put('routes', route); return route;
    }
    async rename(id: string, value: string) {
        const route = await this.repo.get('routes', id);
        if (!route) throw new Error('Rota não encontrada.');
        const name = await this.name(value, id), now = new Date().toISOString();
        await this.repo.put('routes', { ...route, name, updated_at: now, ...pending });
        for (const trip of (await this.repo.all('trips')).filter(t => t.route_id === id)) {
            await this.write(trip.id, current => ({ ...current, route_name: name, updated_at: now, ...pending }));
        }
    }
    async setActive(id: string, active: boolean) {
        const route = await this.repo.get('routes', id);
        if (!route) throw new Error('Rota não encontrada.');
        await this.repo.put('routes', { ...route, active, updated_at: new Date().toISOString(), ...pending });
    }
    async remove(id: string): Promise<never> {
        if ((await this.repo.all('trips')).some(t => t.route_id === id)) throw new Error('Esta rota possui viagens. Desative-a para preservar o histórico.');
        throw new Error('Para preservar o cadastro, use Desativar em vez de excluir.');
    }
    async change(tripId: string, routeId: string | null) {
        const route = routeId ? await this.repo.get('routes', routeId) : null;
        if (routeId && (!route || !route.active)) throw new Error('Escolha uma rota ativa.');
        const now = new Date().toISOString();
        return this.write(tripId, current => {
            if ((current.route_id || null) === routeId && (current.route_name || '') === (route?.name || '')) return current;
            return { ...current, route_id: routeId, route_name: route?.name || '', updated_at: now, ...pending,
                events: [...(current.events || []), { type: current.status === 'recording' ? 'route_changed' : 'route_edited', at: now,
                    details: { previous_route_id: current.route_id || null, previous_route: current.route_name || '', route_id: routeId, route: route?.name || '' } }] };
        });
    }
}
