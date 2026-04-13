import type { Vector2D } from '@/domain';

// ---- Mutable vector for out-parameter pattern ----
export interface MutableVector2D {
  x: number;
  y: number;
}

// ---- Module-level scratch vectors (reuse to minimize GC) ----
const _scratch1: MutableVector2D = { x: 0, y: 0 };
const _scratch2: MutableVector2D = { x: 0, y: 0 };

export { _scratch1, _scratch2 };

// ---- Zero vector constant ----
export const ZERO: Vector2D = { x: 0, y: 0 };

// ---- Creation ----
export function vec(x: number, y: number): Vector2D {
  return { x, y };
}

export function mut(x: number = 0, y: number = 0): MutableVector2D {
  return { x, y };
}

// ---- Out-parameter operations (GC-friendly) ----
export function addOut(a: Vector2D, b: Vector2D, out: MutableVector2D): MutableVector2D {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  return out;
}

export function subOut(a: Vector2D, b: Vector2D, out: MutableVector2D): MutableVector2D {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  return out;
}

export function scaleOut(v: Vector2D, s: number, out: MutableVector2D): MutableVector2D {
  out.x = v.x * s;
  out.y = v.y * s;
  return out;
}

export function normalizeOut(v: Vector2D, out: MutableVector2D): MutableVector2D {
  const m = Math.sqrt(v.x * v.x + v.y * v.y);
  if (m === 0) {
    out.x = 0;
    out.y = 0;
  } else {
    out.x = v.x / m;
    out.y = v.y / m;
  }
  return out;
}

export function lerpOut(a: Vector2D, b: Vector2D, t: number, out: MutableVector2D): MutableVector2D {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  return out;
}

export function rotateOut(v: Vector2D, angle: number, out: MutableVector2D): MutableVector2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  out.x = v.x * cos - v.y * sin;
  out.y = v.x * sin + v.y * cos;
  return out;
}

// ---- Immutable operations (for convenience when GC isn't critical) ----
export function add(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vector2D, b: Vector2D): Vector2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector2D, s: number): Vector2D {
  return { x: v.x * s, y: v.y * s };
}

export function normalize(v: Vector2D): Vector2D {
  const m = Math.sqrt(v.x * v.x + v.y * v.y);
  return m === 0 ? ZERO : { x: v.x / m, y: v.y / m };
}

export function lerp(a: Vector2D, b: Vector2D, t: number): Vector2D {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function rotate(v: Vector2D, angle: number): Vector2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// ---- Scalar operations ----
export function magnitude(v: Vector2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function magnitudeSq(v: Vector2D): number {
  return v.x * v.x + v.y * v.y;
}

export function distance(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceSq(a: Vector2D, b: Vector2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

export function dot(a: Vector2D, b: Vector2D): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Vector2D, b: Vector2D): number {
  return a.x * b.y - a.y * b.x;
}

export function clampMagnitude(v: Vector2D, maxMag: number): Vector2D {
  const magSq = v.x * v.x + v.y * v.y;
  if (magSq <= maxMag * maxMag) return v;
  const mag = Math.sqrt(magSq);
  return { x: (v.x / mag) * maxMag, y: (v.y / mag) * maxMag };
}

export function clampMagnitudeOut(v: Vector2D, maxMag: number, out: MutableVector2D): MutableVector2D {
  const magSq = v.x * v.x + v.y * v.y;
  if (magSq <= maxMag * maxMag) {
    out.x = v.x;
    out.y = v.y;
  } else {
    const mag = Math.sqrt(magSq);
    out.x = (v.x / mag) * maxMag;
    out.y = (v.y / mag) * maxMag;
  }
  return out;
}
