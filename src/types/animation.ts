export type ToolType = 
  | 'pencil' 
  | 'ink' 
  | 'brush' 
  | 'marker'
  | 'spray'
  | 'chalk'
  | 'calligraphy'
  | 'soft' 
  | 'eraser' 
  | 'fill' 
  | 'eyedropper'
  | 'line' 
  | 'rectangle' 
  | 'ellipse';

export interface Point {
  x: number; // Normalized coordinate 0..1
  y: number; // Normalized coordinate 0..1
  pressure?: number; // 0..1 standard pressure value
}

export interface Stroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number; // Normalized brush size relative to canvas height
  opacity: number;
  points: Point[];
  layerId: string;
  frameId: string;
  timestamp: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
}

export interface Frame {
  id: string;
  name: string;
  durationMultiplier?: number; // Holds frame for N frame counts (default 1)
}

export interface OnionSkinSettings {
  enabled: boolean;
  prevFrames: number; // 1..3
  nextFrames: number; // 1..3
  opacity: number; // 0.1 .. 0.8
  prevColor: string; // e.g., '#0066ff'
  nextColor: string; // e.g., '#00cc66'
}

export interface CanvasSettings {
  width: number;
  height: number;
  backgroundColor: string;
  fps: number;
  loop: boolean;
  onionSkin: OnionSkinSettings;
}

export interface Project {
  id: string;
  name: string;
  version: number;
  revision: number; // Monotonically increasing revision counter for sync
  createdAt: number;
  updatedAt: number;
  settings: CanvasSettings;
  layers: Layer[];
  frames: Frame[];
  // Key: `${layerId}:${frameId}` -> Array of Strokes
  layerFrames: Record<string, Stroke[]>;
}

export type DeviceRole = 'draw' | 'display' | 'standalone';

export interface SessionState {
  active: boolean;
  sessionId?: string;
  code?: string;
  role: DeviceRole;
  connectedDevices: number;
  hasDisplayDevice: boolean;
  lastSyncTime?: number;
  pingMs?: number;
  statusText: string;
}

export interface ToolSettings {
  activeTool: ToolType;
  color: string;
  size: number; // 1..100 px display size
  opacity: number; // 0.05..1
  stabilizer: number; // 0..10
  recentColors: string[];
}

export interface ActiveStrokeData {
  strokeId: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  layerId: string;
  frameId: string;
  points: Point[];
}

export interface DiagnosticsData {
  fps: number;
  latencyMs: number;
  strokePointCount: number;
  memoryUsageMb?: number;
  connectedDevices: number;
  lastSyncMs: number;
}
