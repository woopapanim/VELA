import { SimulationEngine } from './SimEngine';
import { SIMULATION_PHASE } from '@/domain';

export type TickCallback = (engine: SimulationEngine) => void;

const TARGET_FPS = 60;
const FRAME_MS = 1000 / TARGET_FPS;

export class SimulationLoop {
  private engine: SimulationEngine;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastTimestamp: number = 0;
  private onTick: TickCallback | null = null;
  private running = false;

  constructor(engine: SimulationEngine) {
    this.engine = engine;
  }

  setOnTick(callback: TickCallback) {
    this.onTick = callback;
  }

  start() {
    this.engine.start();
    this.lastTimestamp = performance.now();
    this.running = true;
    this.scheduleNext();
  }

  stop() {
    this.running = false;
    this.engine.pause();
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  resume() {
    this.engine.resume();
    if (!this.running) {
      this.running = true;
      this.lastTimestamp = performance.now();
      this.scheduleNext();
    }
  }

  destroy() {
    this.stop();
    this.onTick = null;
  }

  getEngine(): SimulationEngine {
    return this.engine;
  }

  private scheduleNext() {
    this.timerId = setTimeout(this.loop, FRAME_MS);
  }

  private loop = () => {
    if (!this.running) return;

    const now = performance.now();
    const state = this.engine.getState();

    if (state.phase === SIMULATION_PHASE.COMPLETED) {
      this.running = false;
      this.onTick?.(this.engine);
      return;
    }

    if (state.phase !== SIMULATION_PHASE.RUNNING) {
      this.scheduleNext();
      return;
    }

    // Compute real delta, cap at 100ms to prevent spiral of death
    const realDelta = Math.min(now - this.lastTimestamp, 100);
    this.lastTimestamp = now;

    // Physics update
    this.engine.update(realDelta);

    // Render callback
    this.onTick?.(this.engine);

    // Next frame
    this.scheduleNext();
  };
}
