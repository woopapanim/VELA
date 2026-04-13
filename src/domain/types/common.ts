// ---- Branded ID pattern ----
declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type ZoneId = Brand<string, 'ZoneId'>;
export type VisitorId = Brand<string, 'VisitorId'>;
export type GroupId = Brand<string, 'GroupId'>;
export type MediaId = Brand<string, 'MediaId'>;
export type GateId = Brand<string, 'GateId'>;
export type FloorId = Brand<string, 'FloorId'>;
export type ScenarioId = Brand<string, 'ScenarioId'>;
export type ComparisonId = Brand<string, 'ComparisonId'>;
export type PinId = Brand<string, 'PinId'>;

// ID factory helpers (zero-cost runtime, compile-time brand)
export const ZoneId = (id: string) => id as ZoneId;
export const VisitorId = (id: string) => id as VisitorId;
export const GroupId = (id: string) => id as GroupId;
export const MediaId = (id: string) => id as MediaId;
export const GateId = (id: string) => id as GateId;
export const FloorId = (id: string) => id as FloorId;
export const ScenarioId = (id: string) => id as ScenarioId;
export const ComparisonId = (id: string) => id as ComparisonId;
export const PinId = (id: string) => id as PinId;

// ---- Geometric primitives ----
export interface Vector2D {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type Polygon = readonly Vector2D[];

// ---- Visual ----
export type HexColor = `#${string}`;

// ---- Time ----
export type UnixMs = number;

// ---- Orientation ----
export type Degrees = number; // 0-360
