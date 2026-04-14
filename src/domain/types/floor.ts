import type { FloorId, ZoneId } from './common';

export interface CanvasData {
  readonly width: number;
  readonly height: number;
  readonly gridSize: number; // 1m grid spacing (px), default 40
  readonly backgroundImage: string | null; // floor plan overlay URL
  readonly scale: number; // px → m conversion ratio
  readonly bgOffsetX: number; // background image X offset (world px), default 0
  readonly bgOffsetY: number; // background image Y offset (world px), default 0
  readonly bgScale: number; // background image scale (relative to native size), default 1
  readonly bgLocked: boolean; // true = placement confirmed, handles hidden
}

export interface FloorConfig {
  readonly id: FloorId;
  readonly name: string; // "1F", "B1", "2F"
  readonly level: number; // sort order: -1=B1, 0=1F, 1=2F
  readonly canvas: CanvasData;
  readonly zoneIds: readonly ZoneId[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
