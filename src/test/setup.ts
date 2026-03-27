import '@testing-library/jest-dom'

// jsdom does not implement ResizeObserver — provide a no-op stub so that
// components using it (e.g. HeatLossCalculator) don't throw in tests.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
