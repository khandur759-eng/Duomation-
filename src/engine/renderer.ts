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
  if (stroke.tool === 'line' && pts.length >= 2) {
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

  if (stroke.tool === 'rectangle' && pts.length >= 2) {
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

  if (stroke.tool === 'ellipse' && pts.length >= 2) {
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

  // Handle Marker / Highlighter tool
  if (stroke.tool === 'marker') {
    ctx.globalAlpha *= 0.5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = baseWidth * 1.5;
    
    if (pts.length === 1) {
      const p = pts[0];
      ctx.fillRect(p.x * canvasWidth - baseWidth / 2, p.y * canvasHeight - baseWidth / 2, baseWidth, baseWidth);
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * canvasWidth, pts[0].y * canvasHeight);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * canvasWidth, pts[i].y * canvasHeight);
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Handle Spray / Airbrush Particle tool
  if (stroke.tool === 'spray') {
    const density = Math.max(12, Math.floor(baseWidth * 1.2));
    const radius = baseWidth * 1.2;
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;
      const pCount = (pts[i].pressure !== undefined ? pts[i].pressure : 0.5) * density;
      
      // Seeded random per point to ensure deterministic rendering
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
    ctx.globalAlpha *= 0.75;
    for (let i = 0; i < pts.length; i++) {
      const px = pts[i].x * canvasWidth;
      const py = pts[i].y * canvasHeight;
      const pressure = pts[i].pressure !== undefined ? pts[i].pressure : 0.5;
      const passCount = Math.max(2, Math.floor(baseWidth * 0.4));
      
      let seed = (i * 49297 + 9301) % 233280;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for (let k = 0; k < passCount; k++) {
        const offsetX = (rnd() - 0.5) * baseWidth * 0.8;
        const offsetY = (rnd() - 0.5) * baseWidth * 0.8;
        const dotSize = Math.max(1, (baseWidth * 0.25) * (0.5 + pressure * 0.8));
        ctx.fillRect(px + offsetX, py + offsetY, dotSize, dotSize);
      }

      if (i > 0) {
        const prevPx = pts[i - 1].x * canvasWidth;
        const prevPy = pts[i - 1].y * canvasHeight;
        ctx.lineWidth = Math.max(1, baseWidth * 0.6);
        ctx.beginPath();
        ctx.moveTo(prevPx + (rnd() - 0.5) * 2, prevPy + (rnd() - 0.5) * 2);
        ctx.lineTo(px + (rnd() - 0.5) * 2, py + (rnd() - 0.5) * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  // Handle Calligraphy Chisel tool
  if (stroke.tool === 'calligraphy') {
    const nibAngle = Math.PI / 4; // 45 degree angle nib
    const nibLen = baseWidth * 1.2;
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

  if (stroke.tool === 'soft') {
    // Soft airbrush rendering
    ctx.shadowColor = stroke.color;
    ctx.shadowBlur = baseWidth * 1.5;
  }

  if (stroke.tool === 'pencil') {
    // Pencil slightly textured feel
    ctx.globalAlpha *= 0.85;
    ctx.lineWidth = Math.max(1, baseWidth * 0.7);
  } else {
    ctx.lineWidth = baseWidth;
  }

  // Freehand path drawing with pressure support
  if (pts.length === 1) {
    const p = pts[0];
    const r = (p.pressure !== undefined ? p.pressure : 0.5) * baseWidth;
    ctx.beginPath();
    ctx.arc(p.x * canvasWidth, p.y * canvasHeight, Math.max(1, r / 2), 0, 2 * Math.PI);
    ctx.fill();
  } else {
    // Pressure sensitive variable stroke segments
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const pressure = curr.pressure !== undefined ? curr.pressure : 0.5;
      const segWidth = Math.max(1, baseWidth * (0.3 + pressure * 0.9));

      ctx.lineWidth = segWidth;
      ctx.beginPath();
      ctx.moveTo(prev.x * canvasWidth, prev.y * canvasHeight);
      ctx.lineTo(curr.x * canvasWidth, curr.y * canvasHeight);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Flood fill implementation for enclosed regions
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const data = imgData.data;

  // Convert hex to RGBA
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.fillStyle = fillColorHex;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillRgb = tempCtx.getImageData(0, 0, 1, 1).data;

  const targetIdx = (Math.floor(startY) * canvasWidth + Math.floor(startX)) * 4;
  const startR = data[targetIdx];
  const startG = data[targetIdx + 1];
  const startB = data[targetIdx + 2];
  const startA = data[targetIdx + 3];

  if (
    startR === fillRgb[0] &&
    startG === fillRgb[1] &&
    startB === fillRgb[2] &&
    startA === fillRgb[3]
  ) {
    return; // Already filled
  }

  const queue: [number, number][] = [[Math.floor(startX), Math.floor(startY)]];
  const visited = new Uint8Array(canvasWidth * canvasHeight);

  while (queue.length > 0) {
    const [x, y] = queue.pop()!;
    if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;

    const idx = y * canvasWidth + x;
    if (visited[idx]) continue;
    visited[idx] = 1;

    const pIdx = idx * 4;
    if (
      Math.abs(data[pIdx] - startR) <= 30 &&
      Math.abs(data[pIdx + 1] - startG) <= 30 &&
      Math.abs(data[pIdx + 2] - startB) <= 30 &&
      Math.abs(data[pIdx + 3] - startA) <= 30
    ) {
      data[pIdx] = fillRgb[0];
      data[pIdx + 1] = fillRgb[1];
      data[pIdx + 2] = fillRgb[2];
      data[pIdx + 3] = 255;

      queue.push([x + 1, y]);
      queue.push([x - 1, y]);
      queue.push([x, y + 1]);
      queue.push([x, y - 1]);
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
