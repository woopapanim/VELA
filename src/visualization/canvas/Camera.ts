import type { Vector2D } from '@/domain';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private minZoom = 0.2;
  private maxZoom = 5;

  setPosition(x: number, y: number) { this.x = x; this.y = y; }
  setZoom(zoom: number) { this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom)); }

  pan(dx: number, dy: number) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  zoomAt(delta: number, screenX: number, screenY: number, canvasWidth: number, canvasHeight: number) {
    const worldBefore = this.screenToWorld(screenX, screenY, canvasWidth, canvasHeight);
    this.zoom *= delta > 0 ? 0.9 : 1.1;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    const worldAfter = this.screenToWorld(screenX, screenY, canvasWidth, canvasHeight);
    this.x += worldBefore.x - worldAfter.x;
    this.y += worldBefore.y - worldAfter.y;
  }

  apply(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x - canvasWidth / 2, -this.y - canvasHeight / 2);
  }

  screenToWorld(sx: number, sy: number, canvasWidth: number, canvasHeight: number): Vector2D {
    return {
      x: (sx - canvasWidth / 2) / this.zoom + this.x + canvasWidth / 2,
      y: (sy - canvasHeight / 2) / this.zoom + this.y + canvasHeight / 2,
    };
  }

  worldToScreen(wx: number, wy: number, canvasWidth: number, canvasHeight: number): Vector2D {
    return {
      x: (wx - this.x - canvasWidth / 2) * this.zoom + canvasWidth / 2,
      y: (wy - this.y - canvasHeight / 2) * this.zoom + canvasHeight / 2,
    };
  }

  zoomToFit(bounds: { minX: number; minY: number; maxX: number; maxY: number }, canvasWidth: number, canvasHeight: number, padding: number = 60) {
    const worldW = bounds.maxX - bounds.minX;
    const worldH = bounds.maxY - bounds.minY;
    if (worldW <= 0 || worldH <= 0) return;
    // bounds 가 viewport 보다 작으면 zoom-in 하지 않음 (1.0 cap).
    // 빈 캔버스에서 작은 zone 한 개 만들 때 500% 로 튀는 것 방지.
    // 큰 floor plan 등 viewport 보다 큰 컨텐츠는 정상적으로 zoom-out.
    const fitScale = Math.min((canvasWidth - padding * 2) / worldW, (canvasHeight - padding * 2) / worldH);
    this.zoom = Math.max(this.minZoom, Math.min(1, fitScale));
    this.x = bounds.minX + worldW / 2 - canvasWidth / 2;
    this.y = bounds.minY + worldH / 2 - canvasHeight / 2;
  }
}
