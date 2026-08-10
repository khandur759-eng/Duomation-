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
    try {
      const project = createNewProject('My 2D Animation');
      setCurrentProject(project);
      setMode('draw');

      // Asynchronous background operations: local save & Socket room session establishment
      saveProject(project).catch((err) => console.error('Background save project error:', err));
      syncService.createSession(project).catch((err) => console.warn('Background create session error:', err));
    } catch (err) {
      console.error('Error creating new project:', err);
    }
  };

  // Action: Open Existing Saved Project
  const handleOpenProject = async (id: string) => {
    try {
      const loaded = await loadProject(id);
      if (loaded) {
        setCurrentProject(loaded);
        setMode('draw');
        syncService.createSession(loaded).catch((err) => console.warn('Background create session error:', err));
      }
    } catch (err) {
      console.error('Error opening project:', err);
    }
  };

  // Action: Import JSON Project
  const handleImportProject = async (project: Project) => {
    try {
      setCurrentProject(project);
      setMode('draw');
      saveProject(project).catch((err) => console.error('Background save imported project error:', err));
      syncService.createSession(project).catch((err) => console.warn('Background create session error:', err));
    } catch (err) {
      console.error('Error importing project:', err);
    }
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
