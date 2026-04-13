export function renderRuler(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  gridSize: number,
  scale: number, // px to meters
  isDark: boolean,
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
) {
  ctx.save();

  const rulerH = 18;
  const textColor = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const tickColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const bgColor = isDark ? 'rgba(9,9,11,0.85)' : 'rgba(244,244,245,0.9)';

  // Calculate world coordinates visible at screen edges
  const worldLeft = cameraX + canvasWidth / 2 - canvasWidth / 2 / cameraZoom;
  const worldTop = cameraY + canvasHeight / 2 - canvasHeight / 2 / cameraZoom;

  // Determine tick spacing based on zoom level
  const baseStep = gridSize * 5; // 5 grid cells
  let worldStep = baseStep;
  // Adjust step so ticks are never too dense or too sparse
  const screenStep = worldStep * cameraZoom;
  if (screenStep < 40) worldStep = baseStep * Math.ceil(40 / screenStep);
  if (screenStep > 300) worldStep = baseStep / Math.max(1, Math.floor(screenStep / 300));

  // ---- Top ruler ----
  ctx.fillStyle = bgColor;
  ctx.fillRect(rulerH, 0, canvasWidth - rulerH, rulerH);

  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.fillStyle = textColor;
  ctx.strokeStyle = tickColor;
  ctx.lineWidth = 0.5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Start from first world tick visible
  const firstTickX = Math.floor(worldLeft / worldStep) * worldStep;
  for (let wx = firstTickX; ; wx += worldStep) {
    // Convert world x to screen x
    const sx = (wx - cameraX - canvasWidth / 2) * cameraZoom + canvasWidth / 2;
    if (sx < rulerH) continue;
    if (sx > canvasWidth) break;

    const meters = Math.round(wx * scale);

    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, rulerH);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.fillText(`${meters}m`, sx, 3);

    // Minor ticks
    const minorStep = worldStep / 5;
    for (let i = 1; i < 5; i++) {
      const msx = ((wx + minorStep * i) - cameraX - canvasWidth / 2) * cameraZoom + canvasWidth / 2;
      if (msx < rulerH || msx > canvasWidth) continue;
      ctx.beginPath();
      ctx.moveTo(msx, rulerH * 0.6);
      ctx.lineTo(msx, rulerH);
      ctx.stroke();
    }
  }

  // ---- Left ruler ----
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, rulerH, rulerH, canvasHeight - rulerH);

  const firstTickY = Math.floor(worldTop / worldStep) * worldStep;
  for (let wy = firstTickY; ; wy += worldStep) {
    const sy = (wy - cameraY - canvasHeight / 2) * cameraZoom + canvasHeight / 2;
    if (sy < rulerH) continue;
    if (sy > canvasHeight) break;

    const meters = Math.round(wy * scale);

    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(rulerH, sy);
    ctx.stroke();

    ctx.save();
    ctx.translate(5, sy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${meters}m`, 0, 0);
    ctx.restore();

    // Minor ticks
    const minorStep = worldStep / 5;
    for (let i = 1; i < 5; i++) {
      const msy = ((wy + minorStep * i) - cameraY - canvasHeight / 2) * cameraZoom + canvasHeight / 2;
      if (msy < rulerH || msy > canvasHeight) continue;
      ctx.beginPath();
      ctx.moveTo(rulerH * 0.6, msy);
      ctx.lineTo(rulerH, msy);
      ctx.stroke();
    }
  }

  // Corner box
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, rulerH, rulerH);

  ctx.restore();
}
