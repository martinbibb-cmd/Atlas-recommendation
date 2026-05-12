import { createContext } from 'react';
import type { AtlasAuthContextValue } from './authTypes';

export const AtlasAuthContext = createContext<AtlasAuthContextValue | null>(null);
