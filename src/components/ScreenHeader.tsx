/** Cabeçalho fixo das telas internas: seta ← e "Voltar" sempre visíveis. */
export function ScreenHeader({ title, onBack }: { title?: string; onBack: () => void }) {
    return <header className="screenHeader"><button type="button" className="backBtn" aria-label="Voltar" onClick={onBack}><span aria-hidden="true">←</span> Voltar</button>{title && <h2>{title}</h2>}</header>;
}
