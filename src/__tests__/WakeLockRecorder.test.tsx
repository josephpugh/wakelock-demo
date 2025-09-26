import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import WakeLockRecorder from '../WakeLockRecorder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);

  public ondataavailable: ((event: { data: Blob; size: number }) => void) | null = null;
  public onstart: (() => void) | null = null;
  public onstop: (() => void) | null = null;
  public onpause: (() => void) | null = null;
  public onresume: (() => void) | null = null;
  public onerror: ((event: unknown) => void) | null = null;

  constructor(public stream: MediaStream, public options?: MediaRecorderOptions) {
    MockMediaRecorder.instances.push(this);
  }

  start = vi.fn(() => {
    this.onstart?.();
  });

  stop = vi.fn(() => {
    this.onstop?.();
  });
}

declare global {
  // eslint-disable-next-line no-var
  var MediaRecorder: typeof MockMediaRecorder;
}

globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;

const setWakeLock = (requestImpl: () => Promise<any>) => {
  Object.defineProperty(navigator, 'wakeLock', {
    configurable: true,
    value: { request: vi.fn(requestImpl) },
  });
  return (navigator as any).wakeLock.request as ReturnType<typeof vi.fn>;
};

const setUserMedia = (impl: () => Promise<MediaStream>) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
  return navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
};

describe('WakeLockRecorder', () => {
  beforeEach(() => {
    MockMediaRecorder.instances = [];
    MockMediaRecorder.isTypeSupported.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts recording and acquires the wake lock on first tap', async () => {
    const release = vi.fn();
    const sentinel = {
      release,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const wakeLockRequest = setWakeLock(() => Promise.resolve(sentinel));

    const track = { stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const getUserMedia = setUserMedia(() => Promise.resolve(stream));

    render(<WakeLockRecorder />);

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await screen.findByText('Recording…');

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(wakeLockRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/wake lock: acquired/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));
    await waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('releases the wake lock if microphone permission is denied', async () => {
    const release = vi.fn();
    const sentinel = {
      release,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const wakeLockRequest = setWakeLock(() => Promise.resolve(sentinel));

    const getUserMedia = setUserMedia(() => Promise.reject(new Error('Device denied')));

    render(<WakeLockRecorder />);

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await screen.findByText('Mic permission failed: Device denied');

    expect(wakeLockRequest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/wake lock: inactive/i)).toBeInTheDocument();
  });

  it('stops recording and cleans up resources', async () => {
    const release = vi.fn();
    const sentinel = {
      release,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    setWakeLock(() => Promise.resolve(sentinel));

    const trackStop = vi.fn();
    const track = { stop: trackStop };
    const stream = {
      getTracks: vi.fn(() => [track as unknown as MediaStreamTrack]),
    } as unknown as MediaStream;
    setUserMedia(() => Promise.resolve(stream));

    render(<WakeLockRecorder />);

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
    await screen.findByText('Recording…');

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));

    await screen.findByText('Idle');

    expect(trackStop).toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
