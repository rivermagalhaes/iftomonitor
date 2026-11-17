import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LogoIF } from '../src/components/LogoIF';
import shapes from '../src/assets/android/symbol.json';

test('LogoIF renderiza pingo vermelho e letras verdes como vetores sem fonte', () => {
    const { container } = render(<LogoIF className="logo"/>);
    const svg = screen.getByRole('img', { name: 'Símbolo do IFTO Monitor' });
    expect(svg.getAttribute('viewBox')).toBe('0 0 108 108');
    expect(svg.querySelector('[data-part="dot"]')?.getAttribute('fill')).toBe('#D83232');
    for (const part of ['letter-i', 'letter-f']) {
        const letter = svg.querySelector(`[data-part="${part}"]`);
        expect(letter?.tagName).toBe('path');
        expect(letter?.getAttribute('fill')).toBe('#2F9E41');
    }
    expect(svg.querySelector('rect')?.getAttribute('fill')).toBe('#2F9E41');
    expect(container.querySelector('text, image, foreignObject')).toBeNull();
});

test('Android colorido e monocromatico compartilham o desenho de LogoIF', () => {
    const root = 'android/app/src/main/res/';
    const foreground = readFileSync(root + 'drawable/ic_launcher_foreground.xml', 'utf8');
    expect(readFileSync(root + 'drawable-v24/ic_launcher_foreground.xml', 'utf8')).toBe(foreground);
    for (const d of [shapes.body, shapes.panel, shapes.letterI, shapes.letterF]) expect(foreground).toContain(d);
    expect(foreground).toContain('#D83232');
    const mono = readFileSync(root + 'drawable/ic_launcher_monochrome.xml', 'utf8');
    expect(mono).toContain('android:fillType="evenOdd"');
    expect(mono).toContain(shapes.letterI);
    expect(mono).toContain(shapes.letterF);
    expect(mono).not.toContain('#2F9E41');
    expect(mono).not.toContain('#D83232');
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
        const adaptive = readFileSync(root + 'mipmap-anydpi-v26/' + name + '.xml', 'utf8');
        expect(adaptive).toContain('<monochrome android:drawable="@drawable/ic_launcher_monochrome"/>');
    }
});
