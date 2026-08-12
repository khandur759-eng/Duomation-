import { Project, Stroke, ToolType, Point, OnionSkinSettings } from '../types/animation';

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  project: Project;
  activeFrameIndex: number;
  activeLayerId?: string;
  activeStroke?: Stroke | null;
  zoom?: number;
  panX?: number;
  panY?: number;
  showOnionSkin?: boolean;
  isExporting?: boolean;
}

/**
 * Draws a single stroke onto a 2D canvas context
 */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  canvasWidth: number,
  canvasHeight: number,
  overrideOpacity?: number
) {
  if (!stroke.points || stroke.points.length === 0) return;

  ctx.save();

  const strokeOpacity = overrideOpacity !== undefined ? overrideOpacity : stroke.opacity;
  ctx.globalAlpha = strokeOpacity;

  // Handle Eraser vs Color Tools
  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  // Calculate base stroke width in px relative to canvas height
  const baseWidth = Math.max(1, stroke.size * (canvasHeight / 800));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pts = stroke.points;

  // Handle Fill tool stroke
  if (stroke.tool === 'fill' && pts.length > 0) {
    floodFill(ctx, pts[0].x * canvasWidth, pts[0].y * canvasHeight, stroke.color, canvasWidth, canvasHeight);
    ctx.restore();
    return;
  }

  // Geometric shapes
  if (stroke.tool === 'line' && pts.length >= 1) {
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.moveTo(p1.x * canvasWidth, p1.y * canvasHeight);
    ctx.lineTo(p2.x * canvasWidth, p2.y * canvasHeight);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'rectangle' && pts.length >= 1) {
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    const x = Math.min(p1.x, p2.x) * canvasWidth;
    const y = Math.min(p1.y, p2.y) * canvasHeight;
    const w = Math.abs(p2.x - p1.x) * canvasWidth;
    const h = Math.abs(p2.y - p1.y) * canvasHeight;

    ctx.lineWidth = baseWidth;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'ellipse' && pts.length >= 1) {
    const p1 = pts[0];
    const p2 = pts[pts.length - 1];
    const cx = ((p1.x + p2.x) / 2) * canvasWidth;
    const cy = ((p1.y + p2.y) / 2) * canvasHeight;
    const rx = (Math.abs(p2.x - p1.x) / 2) * canvasWidth;
    const ry = (Math.abs(p2.y - p1.y) / 2) * canvasHeight;

    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'eyedropper') {
    ctx.restore();
    return;
  }

  // Default / Freehand curve rendering helper
  const renderFreehandCurve = (
    strokeLineWidth: number,
    variablePressure: boolean = true
  ) => {
    if (pts.length === 1) {
      const p = pts[0];
      const pressure = p.pressure !== undefined ? p.pressure : 0.5;
      const r = strokeLineWidth * (variablePressure ? 0.4 + pressure * 0.8 : 1);
      ctx.beginPath();
      ctx.arc(p.x * canvasWidth, p.y * canvasHeight, Math.max(0.5, r / 2), 0, 2 * Math.PI);
      ctx.fill();
      return;
    }

    if (pts.length === 2) {
      const p1 = pts[0];
      const p2 = pts[1];
      const pressure = p2.pressure !== undefined ? p2.pressure : 0.5;
      ctx.lineWidth = strokeLineWidth * (variablePressure ? 0.4 + pressure * 0.8 : 1);
      ctx.beginPath();
      ctx.moveTo(p1.x * canvasWidth, p1.y * canvasHeight);
      ctx.lineTo(p2.x * canvasWidth, p2.y * canvasHeight);
      ctx.stroke();
      return;
    }

    // Check if pressure varies across points
    const hasPressureVariation = variablePressure && pts.some((p) => p.pressure !== undefined && Math.abs(p.pressure - 0.5) > 0.05);

    if (!hasPressureVariation) {
      // High-performance single path quadratic curve smoothing
      ctx.lineWidth = strokeLineWidth;
      ctx.beginPath();
      const p0 = pts[0];
      const p1 = pts[1];
      ctx.moveTo(p0.x * canvasWidth, p0.y * canvasHeight);

      let midX = ((p0.x + p1.x) / 2) * canvasWidth;
      let midY = ((p0.y + p1.y) / 2) * canvasHeight;
      ctx.lineTo(midX, midY);

      for (let i = 1; i < pts.length - 1; i++) {
        const curr = pts[i];
        const next = pts[i + 1];
        const nextMidX = ((curr.x + next.x) / 2) * canvasWidth;
        const nextMidY = ((curr.y + next.y) / 2) * canvasHeight;
        ctx.quadraticCurveTo(
          curr.x * canvasWidth,
          curr.y * canvasHeight,
          nextMidX,
          nextMidY
        );
      }

      const last = pts[pts.length - 1];
      ctx.lineTo(last.x * canvasWidth, last.y * canvasHeight);
      ctx.stroke();
    } else {
      // Segment-by-segment smooth curve with pressure-varying stroke width
      let prevMidX = ((pts[0].x + pts[1].x) / 2) * canvasWidth;
      let prevMidY = ((pts[0].y + pts[1].y) / 2) * canvasHeight;

      // Draw initial segment
      const p0Press = pts[0].pressure !== undefined ? pts[0].pressure : 0.5;
      ctx.lineWidth = Math.max(1, strokeLineWidth * (0.4 + p0Press * 0.8));
      ctx.beginPath();
      ctx.moveTo(pts[0].x * canvasWidth, pts[0].y * canvasHeight);
      ctx.lineTo(prevMidX, prevMidY);
      ctx.stroke();

      for (let i = 1; i < pts.length - 1; i++) {
        const curr = pts[i];
        const next = pts[i + 1];
        const nextMidX = ((curr.x + next.x) / 2) * canvasWidth;
        const nextMidY = ((curr.y + next.y) / 2) * canvasHeight;

        const pPress = curr.pressure !== undefined ? curr.pressure : 0.5;
        ctx.lineWidth = Math.max(1, strokeLineWidth * (0.4 + pPress * 0.8));
        ctx.beginPath();
        ctx.moveTo(prevMidX, prevMidY);
        ctx.quadraticCurveTo(
          curr.x * canvasWidth,
          curr.y * canvasHeight,
          nextMidX,
          nextMidY
        );
        ctx.stroke();

        prevMidX = nextMidX;
        prevMidY = nextMidY;
      }

      // Draw final segment
      const lastPress = pts[pts.length - 1].pressure !== undefined ? pts[pts.length - 1].pressure : 0.5;
      ctx.lineWidth = Math.max(1, strokeLineWidth * (0.4 + lastPress * 0.8));
      ctx.beginPath();
      ctx.moveTo(prevMidX, prevMidY);
      ctx.lineTo(pts[pts.length - 1].x * canvasWidth, pts[pts.length - 1].y * canvasHeight);
      ctx.stroke();
    }
  };

  // Handle Marker / Highlighter tool (Translucent Broad Marker)
  if (stroke.tool === 'marker') {
    ctx.globalAlpha = Math.min(strokeOpacity, 0.4);
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    const markerWidth = baseWidth * 2.2;

    if (pts.length === 1) {
      const p = pts[0];
      ctx.fillRect(p.x * canvasWidth - markerWidth / 2, p.y * canvasHeight - markerWidth / 2, markerWidth, markerWidth);
    } else {
      renderFreehandCurve(markerWidth, false);
    }
    ctx.restore();
    return;
  }

  // Handle Spray / Airbrush Particle tool
  if (stroke.tool === 'spray') {
    const radius = baseWidth * 1.5;
    const density = Math.max(14, Math.floor(baseWidth * 2.2));

    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;
      const pressure = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      const pCount = Math.floor(density * (0.4 + pressure * 0.9));

      // Seeded PRNG for stable rendering
      let seed = (i * 9301 + 49297) % 233280;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for (let j = 0; j < pCount; j++) {
        const angle = rnd() * Math.PI * 2;
        const dist = Math.sqrt(rnd()) * radius;
        const dotX = px + Math.cos(angle) * dist;
        const dotY = py + Math.sin(angle) * dist;
        const dotRadius = 0.5 + rnd() * 1.2;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  // Handle Chalk / Charcoal tool
  if (stroke.tool === 'chalk') {
    ctx.globalAlpha = strokeOpacity * 0.8;
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;
      const pressure = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      const passCount = Math.max(3, Math.floor(baseWidth * 0.5));

      let seed = (i * 49297 + 9301) % 233280;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for (let k = 0; k < passCount; k++) {
        const offsetX = (rnd() - 0.5) * baseWidth * 0.9;
        const offsetY = (rnd() - 0.5) * baseWidth * 0.9;
        const dotSize = Math.max(1, (baseWidth * 0.3) * (0.4 + pressure * 0.8));
        ctx.fillRect(px + offsetX, py + offsetY, dotSize, dotSize);
      }

      if (i > 0) {
        const prevPx = pts[i - 1].x * canvasWidth;
        const prevPy = pts[i - 1].y * canvasHeight;
        ctx.lineWidth = Math.max(1, baseWidth * 0.6);
        ctx.beginPath();
        ctx.moveTo(prevPx + (rnd() - 0.5) * 3, prevPy + (rnd() - 0.5) * 3);
        ctx.lineTo(px + (rnd() - 0.5) * 3, py + (rnd() - 0.5) * 3);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  // Handle Calligraphy Chisel tool
  if (stroke.tool === 'calligraphy') {
    const nibAngle = Math.PI / 4; // 45 degree angle nib
    const nibLen = baseWidth * 1.4;
    const dx = Math.cos(nibAngle) * (nibLen / 2);
    const dy = Math.sin(nibAngle) * (nibLen / 2);

    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;

      if (i === 0) {
        ctx.beginPath();
        ctx.moveTo(px - dx, py - dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.stroke();
      } else {
        const prevPx = pts[i - 1].x * canvasWidth;
        const prevPy = pts[i - 1].y * canvasHeight;

        ctx.beginPath();
        ctx.moveTo(prevPx - dx, prevPy - dy);
        ctx.lineTo(prevPx + dx, prevPy + dy);
        ctx.lineTo(px + dx, py + dy);
        ctx.lineTo(px - dx, py - dy);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  // Handle Soft Airbrush (Gaussian radial falloff)
  if (stroke.tool === 'soft') {
    const radius = Math.max(3, baseWidth * 1.5);
    // Parse hex color to RGB for radial gradient
    const hex = stroke.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;

    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${strokeOpacity * 0.35})`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${strokeOpacity * 0.15})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Handle Paint Brush (Painterly Soft Stroke)
  if (stroke.tool === 'brush') {
    ctx.globalAlpha = strokeOpacity * 0.75;
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = baseWidth * 0.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderFreehandCurve(baseWidth, true);
    ctx.restore();
    return;
  }

  // Handle Pencil (Fine Sketch Stroke)
  if (stroke.tool === 'pencil') {
    ctx.globalAlpha = strokeOpacity * 0.88;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderFreehandCurve(baseWidth * 0.6, true);
    ctx.restore();
    return;
  }

  // Handle Eraser Tool
  if (stroke.tool === 'eraser') {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    renderFreehandCurve(baseWidth * 1.5, true);
    ctx.restore();
    return;
  }

  // Default / Ink Pen (Clean Line Art)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  renderFreehandCurve(baseWidth, true);

  ctx.restore();
}

/**
 * Fast scanline flood fill implementation for enclosed regions
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const ix = Math.floor(startX);
  const iy = Math.floor(startY);
  if (ix < 0 || ix >= canvasWidth || iy < 0 || iy >= canvasHeight) return;

  const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imgData.data;

  // Convert hex color to RGBA
  const hex = fillColorHex.replace('#', '');
  const fillR = parseInt(hex.substring(0, 2), 16) || 0;
  const fillG = parseInt(hex.substring(2, 4), 16) || 0;
  const fillB = parseInt(hex.substring(4, 6), 16) || 0;
  const fillA = 255;

  const startIdx = (iy * canvasWidth + ix) * 4;
  const startR = data[startIdx];
  const startG = data[startIdx + 1];
  const startB = data[startIdx + 2];
  const startA = data[startIdx + 3];

  if (
    Math.abs(startR - fillR) <= 3 &&
    Math.abs(startG - fillG) <= 3 &&
    Math.abs(startB - fillB) <= 3 &&
    Math.abs(startA - fillA) <= 3
  ) {
    return; // Target region is already the fill color
  }

  const tolerance = 45; // Anti-aliasing tolerance
  const visited = new Uint8Array(canvasWidth * canvasHeight);
  const stack: [number, number][] = [[ix, iy]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    let currentY = y;

    while (currentY >= 0) {
      const idx = currentY * canvasWidth + x;
      if (visited[idx]) break;
      const pIdx = idx * 4;
      const diff =
        Math.abs(data[pIdx] - startR) +
        Math.abs(data[pIdx + 1] - startG) +
        Math.abs(data[pIdx + 2] - startB) +
        Math.abs(data[pIdx + 3] - startA);
      if (diff > tolerance) break;
      currentY--;
    }
    currentY++;

    let reachLeft = false;
    let reachRight = false;

    while (currentY < canvasHeight) {
      const idx = currentY * canvasWidth + x;
      if (visited[idx]) break;
      const pIdx = idx * 4;
      const diff =
        Math.abs(data[pIdx] - startR) +
        Math.abs(data[pIdx + 1] - startG) +
        Math.abs(data[pIdx + 2] - startB) +
        Math.abs(data[pIdx + 3] - startA);
      if (diff > tolerance) break;

      visited[idx] = 1;
      data[pIdx] = fillR;
      data[pIdx + 1] = fillG;
      data[pIdx + 2] = fillB;
      data[pIdx + 3] = fillA;

      if (x > 0) {
        const lIdx = currentY * canvasWidth + (x - 1);
        if (!visited[lIdx]) {
          const lpIdx = lIdx * 4;
          const lDiff =
            Math.abs(data[lpIdx] - startR) +
            Math.abs(data[lpIdx + 1] - startG) +
            Math.abs(data[lpIdx + 2] - startB) +
            Math.abs(data[lpIdx + 3] - startA);
          if (lDiff <= tolerance) {
            if (!reachLeft) {
              stack.push([x - 1, currentY]);
              reachLeft = true;
            }
          } else {
            reachLeft = false;
          }
        }
      }

      if (x < canvasWidth - 1) {
        const rIdx = currentY * canvasWidth + (x + 1);
        if (!visited[rIdx]) {
          const rpIdx = rIdx * 4;
          const rDiff =
            Math.abs(data[rpIdx] - startR) +
            Math.abs(data[rpIdx + 1] - startG) +
            Math.abs(data[rpIdx + 2] - startB) +
            Math.abs(data[rpIdx + 3] - startA);
          if (rDiff <= tolerance) {
            if (!reachRight) {
              stack.push([x + 1, currentY]);
              reachRight = true;
            }
          } else {
            reachRight = false;
          }
        }
      }

      currentY++;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Main rendering pass
 */
export function renderCanvasFrame(options: RenderOptions) {
  const {
    canvas,
    project,
    activeFrameIndex,
    activeLayerId,
    activeStroke,
    zoom = 1,
    panX = 0,
    panY = 0,
    showOnionSkin = true,
    isExporting = false,
  } = options;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  ctx.save();

  // Apply Pan and Zoom
  if (!isExporting && (zoom !== 1 || panX !== 0 || panY !== 0)) {
    ctx.translate(width / 2 + panX, height / 2 + panY);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);
  }

  // Draw background color / checkerboard if transparent
  if (project.settings.backgroundColor === 'transparent') {
    if (!isExporting) {
      drawTransparentCheckerboard(ctx, width, height);
    }
  } else {
    ctx.fillStyle = project.settings.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }

  const currentFrame = project.frames[activeFrameIndex];

  // Draw Onion Skin (Previous & Next Frames)
  if (showOnionSkin && project.settings.onionSkin.enabled && !isExporting) {
    const { prevFrames, nextFrames, opacity, prevColor, nextColor } = project.settings.onionSkin;

    // Previous frames
    for (let i = prevFrames; i >= 1; i--) {
      const pIdx = activeFrameIndex - i;
      if (pIdx >= 0 && project.frames[pIdx]) {
        const frame = project.frames[pIdx];
        renderFrameStrokes(ctx, project, frame.id, width, height, null, undefined, opacity * (1 - (i - 1) * 0.2), prevColor);
      }
    }

    // Next frames
    for (let i = 1; i <= nextFrames; i++) {
      const nIdx = activeFrameIndex + i;
      if (nIdx < project.frames.length && project.frames[nIdx]) {
        const frame = project.frames[nIdx];
        renderFrameStrokes(ctx, project, frame.id, width, height, null, undefined, opacity * (1 - (i - 1) * 0.2), nextColor);
      }
    }
  }

  // Render Current Frame Layer by Layer (including active prediction stroke on its target layer)
  if (currentFrame) {
    renderFrameStrokes(ctx, project, currentFrame.id, width, height, activeStroke, activeLayerId);
  }

  ctx.restore();
}

/**
 * Renders all strokes in a frame according to layer stack order & opacity using isolated offscreen layer surfaces
 */
function renderFrameStrokes(
  mainCtx: CanvasRenderingContext2D,
  project: Project,
  frameId: string,
  width: number,
  height: number,
  activeStroke?: Stroke | null,
  activeLayerId?: string,
  tintOpacity?: number,
  tintColor?: string
) {
  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = width;
  layerCanvas.height = height;
  const layerCtx = layerCanvas.getContext('2d');
  if (!layerCtx) return;

  const targetActiveLayerId = activeLayerId || activeStroke?.layerId || project.layers[0]?.id;

  // Render layers bottom to top
  project.layers.forEach((layer) => {
    if (!layer.visible) return;

    const key = `${layer.id}:${frameId}`;
    const strokes = project.layerFrames[key] || [];

    const isCurrentLayerActive = activeStroke && (activeStroke.layerId === layer.id || layer.id === targetActiveLayerId);

    if (strokes.length === 0 && !isCurrentLayerActive) return;

    // Clear offscreen surface for this layer
    layerCtx.clearRect(0, 0, width, height);

    strokes.forEach((stroke) => {
      if (tintColor) {
        if (stroke.tool !== 'eraser') {
          drawStroke(layerCtx, { ...stroke, color: tintColor }, width, height);
        }
      } else {
        drawStroke(layerCtx, stroke, width, height);
      }
    });

    if (isCurrentLayerActive && activeStroke) {
      if (tintColor) {
        if (activeStroke.tool !== 'eraser') {
          drawStroke(layerCtx, { ...activeStroke, color: tintColor }, width, height);
        }
      } else {
        drawStroke(layerCtx, activeStroke, width, height);
      }
    }

    mainCtx.save();
    mainCtx.globalAlpha = (layer.opacity ?? 1) * (tintOpacity !== undefined ? tintOpacity : 1);
    mainCtx.drawImage(layerCanvas, 0, 0);
    mainCtx.restore();
  });
}

function drawTransparentCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const size = 16;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e5e7eb';
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) {
        ctx.fillRect(x, y, size, size);
      }
    }
  }
}
