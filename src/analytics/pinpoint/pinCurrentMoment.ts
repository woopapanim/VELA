import type { StoreState } from '@/stores';
import type { PinnedTimePoint } from '@/domain';
import { capturePin } from './capturePin';

/**
 * Capture the current simulation moment into a pin and add it to the store.
 * Returns the new pin, or null if no simulation state is available.
 * Caller handles UI feedback (toast / tab switch).
 */
export function pinCurrentMoment(
  store: StoreState,
  label: string,
): PinnedTimePoint | null {
  // Require that the sim has produced at least one KPI snapshot.
  // idle phase with no prior run has no meaningful state to pin.
  if (store.phase === 'idle' && !store.latestSnapshot) return null;

  const pin = capturePin({
    zones: store.zones,
    media: store.media,
    visitors: store.visitors,
    mediaStats: store.mediaStats,
    simTimeMs: store.timeState.elapsed,
    label,
    latestSnapshot: store.latestSnapshot,
    totalExited: store.totalExited,
  });

  store.addPin(pin);
  return pin;
}
