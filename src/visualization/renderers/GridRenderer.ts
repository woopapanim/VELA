/**
 * Infinite grid renderer — draws grid lines across the entire visible area,
 * not just the canvas dimensions. Works with camera pan/zoom.
 *
 * Since camera.apply() is called before renderGrid(), the ctx is already
 * in world-space. We need to figure out the world-space bounds of the
 * current viewport and draw grid lines covering that area.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridSize: number,
  isDark: boolean,
  cameraX = 0,
  cameraY = 0,
  cameraZoom = 1,
) {
  // Compute visible world-space bounds from camera state
  const invZoom = 1 / cameraZoom;
  const viewW = width * invZoom;
  const viewH = height * invZoom;
  const worldLeft = cameraX + (width / 2) - (viewW / 2);
  const worldTop = cameraY + (height / 2) - (viewH / 2);
  const worldRight = worldLeft + viewW;
  const worldBottom = worldTop + viewH;

  // Snap to grid boundaries (with padding)
  const startX = Math.floor(worldLeft / gridSize) * gridSize;
  const endX = Math.ceil(worldRight / gridSize) * gridSize;
  const startY = Math.floor(worldTop / gridSize) * gridSize;
  const endY = Math.ceil(worldBottom / gridSize) * gridSize;

  ctx.save();

  // Keep grid lines at constant screen-pixel width regardless of zoom
  const px = 1 / cameraZoom;

  // Minor grid lines
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.5 * px;

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Major grid lines (every 5th)
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 0.75 * px;

  const majorStep = gridSize * 5;
  const majorStartX = Math.floor(worldLeft / majorStep) * majorStep;
  const majorEndX = Math.ceil(worldRight / majorStep) * majorStep;
  const majorStartY = Math.floor(worldTop / majorStep) * majorStep;
  const majorEndY = Math.ceil(worldBottom / majorStep) * majorStep;

  for (let x = majorStartX; x <= majorEndX; x += majorStep) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = majorStartY; y <= majorEndY; y += majorStep) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Origin crosshair (blueprint style)
  if (isDark) {
    ctx.strokeStyle = 'rgba(59,130,246,0.08)';
    ctx.lineWidth = px;
    ctx.setLineDash([8 * px, 8 * px]);
    ctx.beginPath();
    ctx.moveTo(width / 2, startY);
    ctx.lineTo(width / 2, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX, height / 2);
    ctx.lineTo(endX, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}
