import React, { useState, useEffect } from 'react';
import { Project } from '../types/animation';
import { listAllProjects, deleteProject, deleteAllProjects } from '../utils/db';
import { checkSupabaseConnection, SUPABASE_PROJECT_ID } from '../lib/supabase';
import { Plus, Monitor, Smartphone, FolderOpen, Trash2, Upload, Sparkles, Database, CheckCircle2 } from 'lucide-react';

interface HomeProps {
  onCreateProject: () => void;
  onOpenProject: (id: string) => void;
  onJoinSession: (role: 'display' | 'draw') => void;
  onImportProject: (project: Project) => void;
}

export const Home: React.FC<HomeProps> = ({
  onCreateProject,
  onOpenProject,
  onJoinSession,
  onImportProject,
}) => {
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; name: string; updatedAt: number; frameCount: number }>>([]);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({ connected: true, message: 'Supabase Active' });

  const reloadProjects = async () => {
    const list = await listAllProjects();
    setRecentProjects(list);
  };

  useEffect(() => {
    reloadProjects();
    checkSupabaseConnection().then(setDbStatus);
  }, []);


  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this animation project?')) {
      await deleteProject(id);
      await reloadProjects();
    }
  };

  const handleClearAll = async () => {
    if (confirm(`Are you sure you want to delete ALL ${recentProjects.length} animation project(s)? This action cannot be undone.`)) {
      await deleteAllProjects();
      await reloadProjects();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed && parsed.id && parsed.frames) {
            onImportProject(parsed);
          } else {
            alert('Invalid project file format.');
          }
        } catch (err) {
          alert('Failed to parse project file.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto w-full space-y-12">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-indigo-500/20">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Duomation</h1>
              <p className="text-xs text-slate-400 font-mono">Duomation • Two-Device Animation Workstation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono" title={`Supabase Project ID: ${SUPABASE_PROJECT_ID}`}>
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Supabase Cloud Sync</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <label className="cursor-pointer flex items-center gap-2 py-2 px-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Import JSON</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </header>

        {/* Hero & Dual Primary Actions */}
        <section className="space-y-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Two-Device Synchronized Workstation
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Animate effortlessly across two screens.
            </h2>
            <p className="text-slate-400 text-sm max-w-xl">
              Turn device A into a precision tablet drawing controller and device B into a full-screen dedicated animation display monitor.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Create Animation (Device A) */}
            <button
              onClick={onCreateProject}
              className="group relative p-6 rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl shadow-indigo-600/20 text-left transition-all active:scale-[0.99] flex flex-col justify-between h-44 border border-indigo-400/30"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md">
                  <Smartphone className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                  Device A (Draw)
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:translate-x-1 transition-transform flex items-center gap-2">
                  Create Animation <Plus className="w-5 h-5" />
                </h3>
                <p className="text-xs text-indigo-100 mt-1 opacity-90">
                  Start drawing & edit frame timeline on this device.
                </p>
              </div>
            </button>

            {/* Join Session (Device B Display Monitor) */}
            <button
              onClick={() => onJoinSession('display')}
              className="group p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 text-left transition-all active:scale-[0.99] flex flex-col justify-between h-44 hover:bg-slate-900/80"
            >
              <div className="flex justify-between items-start">
                <div className="p-3 rounded-xl bg-slate-800 text-indigo-400">
                  <Monitor className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
                  Device B (Display)
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:translate-x-1 transition-transform flex items-center gap-2">
                  Connect Display Monitor
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Scan QR code or enter code to use this screen as a live monitor.
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* Recent Projects Gallery */}
        <section className="space-y-4 pt-4 border-t border-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-400" />
              Recent Projects ({recentProjects.length})
            </h3>
            {recentProjects.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 py-1 px-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 text-xs font-medium transition-colors"
                title="Delete all recent projects"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Projects</span>
              </button>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-800/80 text-center text-slate-500 text-xs">
              No recent animation projects stored on this device.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj.id)}
                  className="group relative p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/50 hover:bg-slate-900 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-1 truncate pr-2">
                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white truncate">
                      {proj.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {proj.frameCount} frame(s) • {new Date(proj.updatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="text-center text-xs text-slate-600 mt-12 font-mono">
        Duet Workstation • Latency-optimized 2D Animation Protocol
      </footer>
    </div>
  );
};
