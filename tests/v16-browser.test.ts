// @vitest-environment node
import { test, expect } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { resolve } from 'node:path';

test('faixa de status fica opaca e fixa durante rolagem de todas as rotas', async () => {
    const server = await createServer({ configFile: false, define: { 'import.meta.env.VITE_ALLOW_LOCAL_FIELD_MODE': JSON.stringify('true'), 'import.meta.env.VITE_AUTH_LOGIN_ENABLED': JSON.stringify('true') }, resolve: { alias: [['react/jsx-dev-runtime','jsx-dev-runtime'],['react/jsx-runtime','jsx-runtime'],['react-dom/client','react-dom-client'],['react','react'],['react-router-dom','router'],['lucide-react','lucide']].map(([find,file]) => ({ find, replacement: resolve('node_modules/.ifto-deps',file+'.js') })) }, optimizeDeps: { noDiscovery: true }, server: { host: '127.0.0.1', port: 5198, strictPort: true } });
    await server.listen();
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 400 } });
        await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5198') ? route.continue() : route.abort());
        page.on('pageerror', error => console.error('Browser v1.6:', error.message));
        const client = await page.context().newCDPSession(page);
        await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 28, bottom: 24, left: 0, right: 0 } });
        // v2.2: pula o primeiro uso (termos, escolha de modo e permissões) para testar o app do monitor.
        await page.addInitScript(() => { localStorage.setItem('ifto_terms', JSON.stringify({ version: '2.2', accepted_at: '2026-11-20T00:00:00Z' })); localStorage.setItem('ifto_app_mode', 'monitor'); localStorage.setItem('ifto_monitor_setup_done', '1'); });
        await page.goto('http://127.0.0.1:5198');
        await page.getByRole('heading', { name: 'Entrar com e-mail' }).waitFor();
        expect(await page.locator('.statusBarShield').count()).toBe(1);
        await page.getByRole('button', { name: 'Modo campo local', exact: true }).click();
        await page.getByRole('heading', { name: 'Termo de ci\u00eancia' }).waitFor();
        expect(await page.locator('.statusBarShield').count()).toBe(1);
        await page.getByRole('button', { name: 'Voltar', exact: true }).click();
        await page.getByRole('button', { name: 'Modo demonstra\u00e7\u00e3o', exact: true }).click();
        await page.getByRole('heading', { name: 'Ol\u00e1!' }).waitFor();
        for (const [route, title] of [['/', 'Ol\u00e1!'], ['/trip', 'Viagem'], ['/history', 'Hist\u00f3rico'], ['/history/missing', 'Detalhe da viagem'], ['/settings', 'Ajustes'], ['/consent', 'Termo de ci\u00eancia']]) {
            await page.evaluate(route => { window.location.hash = route; }, route);
            await page.getByRole('heading', { name: title, exact: true }).waitFor();
            await page.evaluate(() => {
                const content = document.createElement('p');
                content.dataset.scrollProbe = 'true';
                content.style.height = '1600px';
                content.style.background = '#D83232';
                document.querySelector('main')!.append(content);
                window.scrollTo(0, 500);
            });
            const shield = await page.locator('.statusBarShield').evaluate(el => {
                const style = getComputedStyle(el), bounds = el.getBoundingClientRect();
                return { top: bounds.top, height: bounds.height, background: style.backgroundColor, position: style.position, z: Number(style.zIndex), scroll: window.scrollY };
            });
            expect(shield).toMatchObject({ top: 0, height: 28, background: 'rgb(248, 251, 245)', position: 'fixed' });
            expect(shield.z).toBeGreaterThan(2000);
            expect(shield.scroll).toBeGreaterThan(0);
            expect(await page.locator('.statusBarShield').count()).toBe(1);
            await page.evaluate(() => { document.querySelector('[data-scroll-probe]')?.remove(); window.scrollTo(0, 0); });
        }
    } finally { await browser.close(); await server.close(); }
}, 60000);
