import { createContext, useContext } from 'react';
import type { AppMode } from '../services/appMode';
export interface ModeApi {
    mode: AppMode;
    /** Aluno -> monitor exige o código (validado na tela); monitor -> aluno é direto. */
    switchTo(mode: AppMode): void;
}
export const ModeContext = createContext<ModeApi | null>(null);
export const useModeApi = () => useContext(ModeContext);
