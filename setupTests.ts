import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (!(globalThis as any).jest) {
  (globalThis as any).jest = {
    fn: vi.fn,
    spyOn: vi.spyOn,
    mock: vi.mock,
    clearAllMocks: vi.clearAllMocks,
    resetAllMocks: vi.resetAllMocks,
    restoreAllMocks: vi.restoreAllMocks,
    advanceTimersByTime: vi.advanceTimersByTime,
    useFakeTimers: vi.useFakeTimers,
    useRealTimers: vi.useRealTimers,
    isMockFunction: vi.isMockFunction,
  };
}

await import('jest-canvas-mock');

if (typeof window.PointerEvent === 'undefined') {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    width: number;
    height: number;
    pressure: number;
    tangentialPressure: number;
    tiltX: number;
    tiltY: number;
    twist: number;
    pointerType: string;
    isPrimary: boolean;

    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 0;
      this.width = props.width ?? 0;
      this.height = props.height ?? 0;
      this.pressure = props.pressure ?? 0;
      this.tangentialPressure = props.tangentialPressure ?? 0;
      this.tiltX = props.tiltX ?? 0;
      this.tiltY = props.tiltY ?? 0;
      this.twist = props.twist ?? 0;
      this.pointerType = props.pointerType ?? '';
      this.isPrimary = props.isPrimary ?? false;
    }
  }

  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: PointerEventShim,
  });
}

if (!('createObjectURL' in URL)) {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock'),
    configurable: true,
  });
} else {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}

if (!('revokeObjectURL' in URL)) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
  });
} else {
  URL.revokeObjectURL = vi.fn();
}

Object.defineProperty(globalThis, 'DOMRect', {
  configurable: true,
  value: class DOMRectImpl {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
  },
});
