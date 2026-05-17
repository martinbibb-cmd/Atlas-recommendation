import { useContext } from 'react';
import { ReadingPreferencesContext } from './ReadingPreferencesContext';

export function useReadingPreferences() {
  return useContext(ReadingPreferencesContext);
}
