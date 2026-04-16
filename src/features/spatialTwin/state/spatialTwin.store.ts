import { createElement, createContext, useContext, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { SpatialTwinFeatureState } from './spatialTwin.types';
import type { SpatialTwinAction } from './spatialTwin.actions';
import { spatialTwinReducer, initialSpatialTwinState } from './spatialTwin.reducer';

type SpatialTwinContextValue = [SpatialTwinFeatureState, Dispatch<SpatialTwinAction>];

const SpatialTwinContext = createContext<SpatialTwinContextValue | null>(null);

export function SpatialTwinProvider({ children }: { children: ReactNode }) {
  const value = useReducer(spatialTwinReducer, initialSpatialTwinState);
  return createElement(SpatialTwinContext.Provider, { value }, children);
}

export function useSpatialTwin(): SpatialTwinContextValue {
  const ctx = useContext(SpatialTwinContext);
  if (ctx == null) {
    throw new Error('useSpatialTwin must be used within SpatialTwinProvider');
  }
  return ctx;
}
