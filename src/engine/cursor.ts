import { ToolType, ToolSettings } from '../types/animation';

export interface CursorPos {
  x: number; // Client X
  y: number; // Client Y
  visible: boolean;
}

/**
 * Draws a live brush / tool cursor overlay on the canvas context
 */
export function drawCursorOverlay(
  ctx: CanvasRenderingContext2D,
  cursor: CursorPos,
  toolSettings: ToolSettings,
  zoom: number,
  canvasElement: HTMLCanvasElement
) {
  if (!cursor.visible) return;

  const rect = canvasElement.getBoundingClientRect();
  if (
    cursor.x < rect.left ||
    cursor.x > rect.right ||
    cursor.y < rect.top ||
    cursor.y > rect.bottom
  ) {
    return;
  }

  // Convert client coordinates to canvas pixel coordinates
  const px = ((cursor.x - rect.left) / rect.width) * canvasElement.width;
  const py = ((cursor.y - rect.top) / rect.height) * canvasElement.height;

  // Base brush width in canvas pixels
  const baseWidth = Math.max(1, toolSettings.size * (canvasElement.height / 800));
  const displayRadius = Math.max(2, (baseWidth * zoom) / 2);

  ctx.save();

  const tool = toolSettings.activeTool;

  if (tool === 'eyedropper' || tool === 'fill') {
    // Crosshair cursor with target circle
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;

    // Center circle
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair lines
    const arm = 12;
    ctx.beginPath();
    ctx.moveTo(px - arm, py);
    ctx.lineTo(px - 5, py);
    ctx.moveTo(px + 5, py);
    ctx.lineTo(px + arm, py);
    ctx.moveTo(px, py - arm);
    ctx.lineTo(px, py - 5);
    ctx.moveTo(px, py + 5);
    ctx.lineTo(px, py + arm);
    ctx.stroke();

    // Fill swatch indicator for eyedropper/fill
    if (tool === 'fill') {
      ctx.fillStyle = toolSettings.color;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (tool === 'line' || tool === 'rectangle' || tool === 'ellipse') {
    // Shape precision crosshair
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = toolSettings.color;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.arc(px, py, displayRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px - 6, py);
    ctx.lineTo(px + 6, py);
    ctx.moveTo(px, py - 6);
    ctx.lineTo(px, py + 6);
    ctx.stroke();
  } else if (tool === 'eraser') {
    // Eraser dashed ring indicator
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#ef4444';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 3;

    ctx.beginPath();
    ctx.arc(px, py, displayRadius * 1.5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, displayRadius * 1.5 + 1, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Standard drawing tools: Pencil, Ink, Brush, Marker, Spray, Chalk, Calligraphy, Soft
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = toolSettings.color;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.arc(px, py, displayRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner contrast ring for visibility on matching backgrounds
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, displayRadius - 1), 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
