import { act, fireEvent, render, screen } from '@testing-library/react';
import SignaturePad from '../SignaturePad';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PointerTarget = EventTarget & Element;

type SetupResult = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D & {
    __getEvents(): Array<{ type: string }>;
    __clearEvents(): void;
    __clearDrawCalls(): void;
  };
  triggerOrientation: (matches: boolean) => void;
};

const createPointerEvent = (
  type: string,
  target: PointerTarget,
  values: Partial<PointerEvent>,
): PointerEvent => {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: values.pointerId ?? 1,
    clientX: values.clientX ?? 0,
    clientY: values.clientY ?? 0,
  });
  Object.defineProperty(event, 'target', { value: target });
  return event;
};

describe('SignaturePad', () => {
  beforeEach(() => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
  });

  afterEach(() => {
    delete (window as any).matchMedia;
    delete (window as any).ResizeObserver;
    vi.restoreAllMocks();
  });

  const setup = (props?: Parameters<typeof SignaturePad>[0]): SetupResult => {
    const changeListeners = new Set<(event: MediaQueryListEvent) => void>();
    let currentMatch = false;

    const mediaQueryList: MediaQueryList = {
      matches: currentMatch,
      media: '(orientation: portrait)',
      onchange: null,
      addEventListener: vi.fn((event, listener: EventListener) => {
        if (event === 'change') changeListeners.add(listener as (event: MediaQueryListEvent) => void);
      }),
      removeEventListener: vi.fn((event, listener: EventListener) => {
        if (event === 'change') changeListeners.delete(listener as (event: MediaQueryListEvent) => void);
      }),
      addListener: vi.fn((listener: MediaQueryListListener) => changeListeners.add(listener)),
      removeListener: vi.fn((listener: MediaQueryListListener) => changeListeners.delete(listener)),
      dispatchEvent: vi.fn((event: Event) => {
        changeListeners.forEach((listener) => listener(event as MediaQueryListEvent));
        return true;
      }),
    } as MediaQueryList;

    const triggerOrientation = (matches: boolean) => {
      currentMatch = matches;
      mediaQueryList.matches = matches;
      const event = new Event('change') as MediaQueryListEvent;
      Object.defineProperty(event, 'matches', { value: matches });
      mediaQueryList.onchange?.(event);
      changeListeners.forEach((listener) => listener(event));
    };

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => mediaQueryList),
    });

    class MockResizeObserver implements ResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      disconnect = vi.fn();
      observe = vi.fn((target: Element) => {
        this.callback([{ target } as ResizeObserverEntry], this);
      });
      unobserve = vi.fn();
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver,
    });

    render(<SignaturePad {...(props ?? {})} />);

    const canvases = screen.getAllByLabelText(/signature pad/i) as HTMLCanvasElement[];
    const canvas = canvases[canvases.length - 1];
    (canvas as any).setPointerCapture = vi.fn();
    (canvas as any).releasePointerCapture = vi.fn();

    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 100));

    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    const ctx = canvas.getContext('2d') as SetupResult['ctx'];
    ctx.__clearEvents();
    ctx.__clearDrawCalls();

    return { canvas, ctx, triggerOrientation };
  };

  it('draws strokes on pointer interaction and supports undo/clear', () => {
    const { canvas, ctx } = setup();

    const down = createPointerEvent('pointerdown', canvas, { clientX: 10, clientY: 10 });
    const move = createPointerEvent('pointermove', canvas, { clientX: 25, clientY: 25 });
    const up = createPointerEvent('pointerup', canvas, { clientX: 40, clientY: 40 });

    act(() => {
      canvas.dispatchEvent(down);
      canvas.dispatchEvent(move);
      window.dispatchEvent(up);
    });

    expect(ctx.__getEvents().length).toBeGreaterThan(0);

    const undoButtons = screen.getAllByRole('button', { name: /undo/i });
    const undoButton = undoButtons[undoButtons.length - 1];
    ctx.__clearEvents();
    fireEvent.click(undoButton);
    expect(ctx.__getEvents().some((event) => event.type === 'clearRect')).toBe(true);

    const clearButtons = screen.getAllByRole('button', { name: /clear/i });
    const clearButton = clearButtons[clearButtons.length - 1];
    ctx.__clearEvents();
    fireEvent.click(clearButton);
    expect(ctx.__getEvents().some((event) => event.type === 'clearRect')).toBe(true);
  });

  it('invokes onSave with a blob when Save PNG is clicked', async () => {
    const onSave = vi.fn();
    const { canvas } = setup({ onSave });

    vi.spyOn(canvas, 'toBlob').mockImplementation((callback: BlobCallback | null) => {
      callback?.(new Blob(['test'], { type: 'image/png' }));
    });

    await act(async () => {
      const saveButtons = screen.getAllByRole('button', { name: /save png/i });
      fireEvent.click(saveButtons[saveButtons.length - 1]);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const blobArg = onSave.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it('blocks drawing when portrait overlay is visible', () => {
    const { canvas, ctx, triggerOrientation } = setup();

    act(() => {
      triggerOrientation(true);
    });

    const down = createPointerEvent('pointerdown', canvas, { clientX: 10, clientY: 10 });
    act(() => {
      canvas.dispatchEvent(down);
    });

    expect(ctx.__getEvents().length).toBe(0);
  });
});
