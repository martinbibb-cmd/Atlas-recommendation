import { createContext, useContext } from 'react';

/** Presentation mode: engineer = fast/dense, customer = explanation-first. */
export type UiMode = 'engineer' | 'customer';

export interface UiModeContextValue {
  uiMode: UiMode;
  setUiMode: (mode: UiMode) => void;
}

export const UiModeContext = createContext<UiModeContextValue>({
  uiMode: 'engineer',
  setUiMode: () => {},
});

/** Hook to read and update the global UI mode. */
export function useUiMode(): UiModeContextValue {
  return useContext(UiModeContext);
}
