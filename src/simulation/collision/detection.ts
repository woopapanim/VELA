import type { Vector2D, VisitorId } from '@/domain';

// ---- Spatial Hash Grid for O(n) neighbor queries ----
export class SpatialHash {
  private cellSize: number;
  private cells = new Map<string, VisitorId[]>();
  private positions = new Map<string, Vector2D>(); // VisitorId string -> position

  constructor(cellSize: number = 40) {
    this.cellSize = cellSize;
  }

  clear() {
    this.cells.clear();
    this.positions.clear();
  }

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  private cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  insert(id: VisitorId, position: Vector2D) {
    const cx = this.cellCoord(position.x);
    const cy = this.cellCoord(position.y);
    const k = this.key(cx, cy);

    let cell = this.cells.get(k);
    if (!cell) {
      cell = [];
      this.cells.set(k, cell);
    }
    cell.push(id);
    this.positions.set(id as string, position);
  }

  // Find all neighbors within radius (returns IDs excluding self)
  queryRadius(id: VisitorId, radius: number): { id: VisitorId; position: Vector2D; distSq: number }[] {
    const pos = this.positions.get(id as string);
    if (!pos) return [];

    const results: { id: VisitorId; position: Vector2D; distSq: number }[] = [];
    const radiusSq = radius * radius;

    const minCx = this.cellCoord(pos.x - radius);
    const maxCx = this.cellCoord(pos.x + radius);
    const minCy = this.cellCoord(pos.y - radius);
    const maxCy = this.cellCoord(pos.y + radius);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;

        for (const otherId of cell) {
          if (otherId === id) continue;
          const otherPos = this.positions.get(otherId as string);
          if (!otherPos) continue;

          const dx = otherPos.x - pos.x;
          const dy = otherPos.y - pos.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < radiusSq) {
            results.push({ id: otherId, position: otherPos, distSq });
          }
        }
      }
    }

    return results;
  }

  getPosition(id: VisitorId): Vector2D | undefined {
    return this.positions.get(id as string);
  }
}
