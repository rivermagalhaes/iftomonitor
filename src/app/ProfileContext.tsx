import { createContext, useContext } from 'react';
import type { Profile } from '../services/profile';
export interface ProfileApi { profile: Profile | null; save(profile: Profile): void; /** "Trocar usuário": apaga só o cadastro e volta ao cadastro. */ reset(): void }
export const ProfileContext = createContext<ProfileApi>({ profile: null, save: () => { }, reset: () => { } });
export const useProfile = () => useContext(ProfileContext);
