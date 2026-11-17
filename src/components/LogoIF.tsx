import shapes from '../assets/android/symbol.json';
// Paleta derivada de tokens.css pelo gerador visual, junto dos vetores Android.
const { primary, white, red } = shapes.colors;

export function LogoIF({ className }: { className?: string }) {
    return <svg className={className} viewBox="0 0 108 108" role="img" aria-label="Símbolo do IFTO Monitor" focusable="false">
        <rect width="108" height="108" rx="24" fill={primary}/>
        <path d={shapes.wheels} fill={white}/>
        <path d={shapes.mirrors} fill={white}/>
        <path d={shapes.body} fill={white}/>
        <path d={shapes.panelFrame} fill={primary}/>
        <path d={shapes.panel} fill={white}/>
        <path data-part="letter-i" d={shapes.letterI} fill={primary}/>
        <path data-part="letter-f" d={shapes.letterF} fill={primary}/>
        <circle data-part="dot" {...shapes.dot} fill={red}/>
        <path d={shapes.headlights} fill={primary}/>
    </svg>;
}
