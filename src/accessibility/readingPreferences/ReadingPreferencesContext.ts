import { createContext, useContext } from 'react';
import type { ReadingPreferencesV1 } from './ReadingPreferencesV1';
import { DEFAULT_READING_PREFERENCES_V1 } from './ReadingPreferencesV1';

export interface ReadingPreferencesContextValue {
  enabled: boolean;
  panelOpen: boolean;
  profile: ReadingPreferencesV1;
  setPanelOpen: (open: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  updateProfile: (patch: Partial<ReadingPreferencesV1>) => void;
  resetProfile: () => void;
}

const noop = () => {};

export const FALLBACK_READING_PREFERENCES_CONTEXT: ReadingPreferencesContextValue = {
  enabled: false,
  panelOpen: false,
  profile: DEFAULT_READING_PREFERENCES_V1,
  setPanelOpen: noop,
  setEnabled: noop,
  updateProfile: noop,
  resetProfile: noop,
};

export const ReadingPreferencesContext = createContext<ReadingPreferencesContextValue>(
  FALLBACK_READING_PREFERENCES_CONTEXT,
);

export function useReadingPreferences() {
  return useContext(ReadingPreferencesContext);
}
