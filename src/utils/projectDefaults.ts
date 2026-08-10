import { Project, Layer, Frame, CanvasSettings } from '../types/animation';

export function createNewProject(name = 'Untitled Animation'): Project {
  const defaultLayer: Layer = {
    id: 'layer_1',
    name: 'Layer 1',
    visible: true,
    locked: false,
    opacity: 1,
  };

  const initialFrames: Frame[] = [
    { id: 'frame_1', name: 'Frame 1', durationMultiplier: 1 },
    { id: 'frame_2', name: 'Frame 2', durationMultiplier: 1 },
    { id: 'frame_3', name: 'Frame 3', durationMultiplier: 1 },
    { id: 'frame_4', name: 'Frame 4', durationMultiplier: 1 },
  ];

  const defaultSettings: CanvasSettings = {
    width: 1920,
    height: 1080,
    backgroundColor: '#ffffff',
    fps: 12, // Specification: default to 12 FPS
    loop: true,
    onionSkin: {
      enabled: false,
      prevFrames: 1,
      nextFrames: 1,
      opacity: 0.35,
      prevColor: '#0066ff',
      nextColor: '#00cc66',
    },
  };

  return {
    id: 'proj_' + Math.random().toString(36).substring(2, 9),
    name,
    version: 1,
    revision: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: defaultSettings,
    layers: [defaultLayer],
    frames: initialFrames,
    layerFrames: {},
  };
}
