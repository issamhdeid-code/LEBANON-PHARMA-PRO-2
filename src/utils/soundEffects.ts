/**
 * Synthesizes a subtle, pleasant confirmation sound effect using the Web Audio API.
 * Operates 100% locally and offline without external audio files, with zero latency.
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioCtx();
    }

    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }

    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Plays a subtle, high-frequency "beep" (1850 Hz, ~75ms)
 * to confirm that an item was successfully scanned and added to the cart.
 *
 * @param volume Master volume between 0.0 and 1.0 (defaults to 0.15 for a subtle chime)
 */
export function playScanBeepSound(volume: number = 0.15): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Standard high-register retail scanner confirmation pitch (1850 Hz)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, now);

    // Smooth envelope with fast attack and exponential decay to prevent clicks
    const targetVolume = Math.max(0.01, Math.min(1.0, volume));
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(targetVolume, now + 0.006); // 6ms attack
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.075); // 75ms decay

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Non-blocking: fail gracefully if autoplay policy blocks or audio device unavailable
  }
}
