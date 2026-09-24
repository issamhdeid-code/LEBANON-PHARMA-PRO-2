import { describe, it, expect, vi } from 'vitest';
import { playScanBeepSound } from './soundEffects';

describe('soundEffects - playScanBeepSound', () => {
  it('does not throw in environments without Web Audio API support', () => {
    expect(() => playScanBeepSound()).not.toThrow();
  });

  it('safely handles simulated Web Audio API with oscillators and gain nodes', () => {
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockContext = {
      currentTime: 10,
      state: 'running',
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGain),
      destination: {},
    };

    // Temporarily mock window and AudioContext on globalThis
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = {
      AudioContext: vi.fn().mockImplementation(() => mockContext),
    };

    try {
      expect(() => playScanBeepSound(0.2)).not.toThrow();
      expect(mockOscillator.start).toHaveBeenCalled();
      expect(mockOscillator.stop).toHaveBeenCalled();
      expect(mockGain.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
});
