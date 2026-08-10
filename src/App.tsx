import React, { useState, useEffect } from 'react';
import { Project, DeviceRole, SessionState } from './types/animation';
import { createNewProject } from './utils/projectDefaults';
import { loadProject, saveProject } from './utils/db';
import { syncService } from './services/syncService';

import { Home } from './components/Home';
import { DrawingWorkspace } from './components/DrawingWorkspace';
import { DisplayWorkspace } from './components/DisplayWorkspace';
import { PairingModal } from './components/PairingModal';

export default function App() {
  const [mode, setMode] = useState<'home' | 'draw' | 'display'>('home');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);

  const [sessionState, setSessionState] = useState<SessionState>(syncService.getState());
  const [isJoinModalOpen, setIsJoinModalOpen] = useState<boolean>(false);

  useEffect(() => {
    syncService.init();

    const unsubscribe = syncService.subscribe((event, data) => {
      if (event === 'state-changed') {
        setSessionState(data);
      }
    });

    // Check if opened with ?join=CODE URL query parameter
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      handleJoinSessionByCode(joinCode, 'display');
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Action: Create New Animation (Device A Drawing)
  const handleCreateNewProject = async () => {
    const project = createNewProject('My 2D Animation');
    await saveProject(project);
    setCurrentProject(project);

    // Create Socket room for two-device pairing
    await syncService.createSession(project);
    setMode('draw');
  };

  // Action: Open Existing Saved Project
  const handleOpenProject = async (id: string) => {
    const loaded = await loadProject(id);
    if (loaded) {
      setCurrentProject(loaded);
      await syncService.createSession(loaded);
      setMode('draw');
    }
  };

  // Action: Import JSON Project
  const handleImportProject = async (project: Project) => {
    await saveProject(project);
    setCurrentProject(project);
    await syncService.createSession(project);
    setMode('draw');
  };

  // Action: Join Session by 6-digit Code or QR scan
  const handleJoinSessionByCode = async (code: string, role: DeviceRole = 'display') => {
    const res = await syncService.joinSession(code, role);
    if (res.success) {
      if (res.project) {
        setCurrentProject(res.project);
      } else {
        // Fallback default project if waiting for snapshot
        setCurrentProject(createNewProject('Display Session'));
      }
      setIsJoinModalOpen(false);
      setMode('display');
    } else {
      alert(res.error || 'Failed to join session.');
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
      {mode === 'home' && (
        <Home
          onCreateProject={handleCreateNewProject}
          onOpenProject={handleOpenProject}
          onJoinSession={(role) => setIsJoinModalOpen(true)}
          onImportProject={handleImportProject}
        />
      )}

      {mode === 'draw' && currentProject && (
        <DrawingWorkspace
          project={currentProject}
          sessionState={sessionState}
          onReturnHome={() => setMode('home')}
        />
      )}

      {mode === 'display' && currentProject && (
        <DisplayWorkspace
          project={currentProject}
          activeFrameIndex={activeFrameIndex}
          sessionState={sessionState}
          onLeaveDisplayMode={() => setMode('home')}
        />
      )}

      {/* Join Session Modal for Display device */}
      <PairingModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        role="display"
        onJoinSession={(code) => handleJoinSessionByCode(code, 'display')}
      />
    </div>
  );
}
