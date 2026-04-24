import '@testing-library/jest-dom'
import { webcrypto } from 'node:crypto'

// jsdom does not implement ResizeObserver — provide a no-op stub so that
// components using it (e.g. HeatLossCalculator) don't throw in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not expose window.matchMedia — provide a minimal stub so that
// components using it (e.g. FloorPlanBuilder mobile-layout detection) don't
// throw in tests.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not expose crypto.subtle — polyfill with Node's Web Crypto
// implementation so that portalToken HMAC tests can run.
if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.subtle === 'undefined'
) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}
