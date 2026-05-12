import { useContext } from 'react';
import { AtlasAuthContext } from './AtlasAuthContext';
import type { AtlasAuthContextValue } from './authTypes';

export function useAtlasAuth(): AtlasAuthContextValue {
  const context = useContext(AtlasAuthContext);
  if (context === null) {
    throw new Error('useAtlasAuth must be used inside <AtlasAuthProvider>.');
  }
  return context;
}
