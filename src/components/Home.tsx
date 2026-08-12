import React, { useState, useEffect } from 'react';
import { Project } from '../types/animation';
import { listAllProjects, deleteProject, deleteAllProjects } from '../utils/db';
import { checkSupabaseConnection, SUPABASE_PROJECT_ID } from '../lib/supabase';
import {
  Plus,
  Monitor,
  Smartphone,
  FolderOpen,
  Trash2,
  Upload,
  Sparkles,
  Database,
  CheckCircle2
} from 'lucide-react';

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
  const [recentProjects, setRecentProjects] = useState<
    Array<{
      id: string;
      name: string;
      updatedAt: number;
      frameCount: number;
    }>
  >([]);

  const [dbStatus, setDbStatus] = useState<{
    connected: boolean;
    message: string;
  }>({
    connected: true,
    message: 'Supabase Active'
  });

  const reloadProjects = async () => {
    const list = await listAllProjects();
    setRecentProjects(list);
  };

  useEffect(() => {
    reloadProjects();
    checkSupabaseConnection().then(setDbStatus);
  }, []);

  const handleDelete = async (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();

    if (confirm('Delete this animation project?')) {
      await deleteProject(id);
      await reloadProjects();
    }
  };

  const handleClearAll = async () => {
    if (
      confirm(
        `Are you sure you want to delete ALL ${recentProjects.length} animation project(s)? This action cannot be undone.`
      )
    ) {
      await deleteAllProjects();
      await reloadProjects();
    }
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(
            event.target?.result as string
          );

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
    <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden bg-[#f7f7fb] text-slate-950 flex flex-col p-5 sm:p-7 md:p-10 lg:p-14 selection:bg-indigo-200 selection:text-indigo-950">

      {/* Floating animation styles — visual only */}
      <style>{`
        @keyframes duomation-float {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-6px);
          }
        }

        .duomation-float {
          animation: duomation-float 5s ease-in-out infinite;
          will-change: transform;
        }

        .duomation-float-delay {
          animation: duomation-float 5.8s ease-in-out infinite;
          animation-delay: -1.5s;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .duomation-float,
          .duomation-float-delay {
            animation: none;
          }
        }
      `}</style>

      {/* Premium background atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-300/25 blur-3xl" />
        <div className="absolute top-20 right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-fuchsia-200/30 blur-3xl" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-200/25 blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto w-full space-y-16 sm:space-y-20">

        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

          <div className="flex items-center gap-3 sm:gap-4">

            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 flex items-center justify-center font-black text-white text-xl sm:text-2xl shadow-xl shadow-indigo-500/25">
              D
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight">
                Duomation
              </h1>

              <p className="text-xs sm:text-sm text-slate-500 font-mono">
                2D Animation Workstation
              </p>
            </div>

          </div>

          <div className="hidden items-center gap-2">

            <div
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-mono"
              title={`Supabase Project ID: ${SUPABASE_PROJECT_ID}`}
            >
              <Database className="w-3.5 h-3.5" />

              <span>
                Supabase Cloud Sync
              </span>

              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>

            <label className="cursor-pointer flex items-center gap-2 py-2 px-3.5 rounded-xl bg-white/80 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-medium transition-colors">

              <Upload className="w-4 h-4 text-slate-500" />

              <span>
                Import JSON
              </span>

              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />

            </label>

          </div>

        </header>


        {/* Hero & Dual Primary Actions */}
        <section className="space-y-9">

          <div className="max-w-4xl space-y-5">

            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/75 backdrop-blur-xl border border-indigo-100 text-indigo-600 text-xs sm:text-sm font-semibold shadow-sm">

              <Sparkles className="w-4 h-4" />

              Two-Device Synchronized Workstation

            </span>

            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.98] tracking-[-0.055em] text-slate-950">

              Animate effortlessly across{' '}

              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">

                two screens.

              </span>

            </h2>

            <p className="text-base sm:text-lg lg:text-xl leading-8 text-slate-500 max-w-2xl">

              Turn device A into a precision tablet drawing controller and device B into a full-screen dedicated animation display monitor.

            </p>

          </div>


          {/* Primary Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Create Animation */}
            <button
              onClick={onCreateProject}
              className="duomation-float group relative p-6 sm:p-7 rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-400 text-white shadow-2xl shadow-indigo-500/25 text-left transition-all active:scale-[0.99] flex flex-col justify-between min-h-48 sm:min-h-52 border border-white/30 overflow-hidden"
            >

              <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/20 blur-2xl group-hover:scale-125 transition-transform" />

              <div className="relative flex justify-between items-start">

                <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">

                  <Smartphone className="w-6 h-6 text-white" />

                </div>

                <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider bg-white/15 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/20">

                  Device A (Draw)

                </span>

              </div>

              <div className="relative">

                <h3 className="text-2xl sm:text-3xl font-bold text-white group-hover:translate-x-1 transition-transform flex items-center gap-2 tracking-tight">

                  Create Animation

                  <Plus className="w-5 h-5 sm:w-6 sm:h-6" />

                </h3>

                <p className="text-sm text-indigo-50/90 mt-2">

                  Start drawing & edit frame timeline on this device.

                </p>

              </div>

            </button>


            {/* Join Session / Display Monitor */}
            <button
              onClick={() => onJoinSession('display')}
              className="duomation-float-delay group relative p-6 sm:p-7 rounded-[2rem] bg-white/75 backdrop-blur-xl border border-slate-200 hover:border-indigo-200 hover:bg-white text-slate-950 text-left transition-all active:scale-[0.99] flex flex-col justify-between min-h-48 sm:min-h-52 shadow-xl shadow-slate-200/40 overflow-hidden"
            >

              <div className="absolute -right-16 -bottom-20 h-44 w-44 rounded-full bg-indigo-100/60 blur-3xl group-hover:bg-violet-100/70 transition-colors" />

              <div className="relative flex justify-between items-start">

                <div className="p-3 rounded-2xl bg-slate-100 text-indigo-600 ring-1 ring-slate-200">

                  <Monitor className="w-6 h-6" />

                </div>

                <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-3 py-1.5 rounded-full">

                  Device B (Display)

                </span>

              </div>

              <div className="relative">

                <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 group-hover:translate-x-1 transition-transform flex items-center gap-2 tracking-tight">

                  Connect Display Monitor

                </h3>

                <p className="text-sm text-slate-500 mt-2">

                  Scan QR code or enter code to use this screen as a live monitor.

                </p>

              </div>

            </button>

          </div>

        </section>


        {/* Recent Projects Gallery */}
        <section className="space-y-5 pt-8 border-t border-slate-200/80">

          <div className="flex items-center justify-between">

            <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">

              <FolderOpen className="w-4 h-4 text-indigo-500" />

              Recent Projects ({recentProjects.length})

            </h3>

            {recentProjects.length > 0 && (

              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-rose-50 border border-rose-100 text-rose-500 hover:bg-rose-100 hover:text-rose-600 text-xs font-medium transition-colors"
                title="Delete all recent projects"
              >

                <Trash2 className="w-3.5 h-3.5" />

                <span>
                  Clear All Projects
                </span>

              </button>

            )}

          </div>


          {recentProjects.length === 0 ? (

            <div className="p-10 rounded-3xl border border-dashed border-slate-300 bg-white/45 text-center text-slate-400 text-xs shadow-sm">

              No recent animation projects stored on this device.

            </div>

          ) : (

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">

              {recentProjects.map((proj) => (

                <div
                  key={proj.id}
                  className="group relative p-4 rounded-2xl bg-white/70 backdrop-blur-xl border border-slate-200 hover:border-indigo-200 hover:bg-white cursor-pointer transition-all flex items-center justify-between shadow-sm hover:shadow-lg hover:shadow-indigo-100/40"
                >

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => onOpenProject(proj.id)}
                  >

                    <div className="space-y-1 truncate pr-2">

                      <h4 className="text-sm font-semibold text-slate-800 group-hover:text-slate-950 truncate">

                        {proj.name}

                      </h4>

                      <p className="text-[11px] text-slate-400 font-mono">

                        {proj.frameCount} frame(s) • {new Date(proj.updatedAt).toLocaleDateString()}

                      </p>

                    </div>

                  </div>


                  <button
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                    title="Delete Project"
                  >

                    <Trash2 className="w-4 h-4" />

                  </button>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* SEO & Product Information */}
        <section className="space-y-10 pt-8 border-t border-slate-200/80">

          {/* Main Description */}
          <div className="space-y-4">

            <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold">

              Dual-Device Creative Workspace

            </span>

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">

              Connect Two Devices. Create as One.

            </h2>

            <p className="text-sm sm:text-base leading-7 text-slate-500 max-w-3xl">

              Duomation is a dual-device creative workspace designed to connect two devices into one synchronized animation workflow. Use one device as your drawing and animation controller while another device becomes a dedicated display screen. Duomation brings both screens together so you can create, preview, and work with animations across devices directly in your browser.

            </p>

          </div>


          {/* Dual Device Workflow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="p-6 rounded-3xl bg-white/65 border border-slate-200 shadow-lg shadow-slate-200/30 backdrop-blur-xl">

              <div className="flex items-center gap-3 mb-4">

                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">

                  <Smartphone className="w-5 h-5" />

                </div>

                <h3 className="text-lg font-semibold text-slate-950">

                  Device A — Create

                </h3>

              </div>

              <p className="text-sm leading-6 text-slate-500">

                Use your primary device as a drawing and animation workspace. Create frames, draw your artwork, edit your animation timeline, manage layers, and control your animation from one screen.

              </p>

            </div>


            <div className="p-6 rounded-3xl bg-white/65 border border-slate-200 shadow-lg shadow-slate-200/30 backdrop-blur-xl">

              <div className="flex items-center gap-3 mb-4">

                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">

                  <Monitor className="w-5 h-5" />

                </div>

                <h3 className="text-lg font-semibold text-slate-950">

                  Device B — Display

                </h3>

              </div>

              <p className="text-sm leading-6 text-slate-500">

                Connect a second device as a live animation display. Your animation workspace can stay on one device while the second screen provides a dedicated view of the animation.

              </p>

            </div>

          </div>


          {/* How It Works */}
          <div className="space-y-5">

            <h2 className="text-2xl font-bold text-slate-950">

              How Duomation Works

            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              <div className="p-5 rounded-2xl bg-white/55 border border-slate-200 backdrop-blur-xl">

                <div className="text-indigo-600 font-bold text-sm mb-2">

                  01 — Connect

                </div>

                <h3 className="text-base font-semibold text-slate-950 mb-2">

                  Connect Two Devices

                </h3>

                <p className="text-sm leading-6 text-slate-500">

                  Pair your devices using the Duomation connection system and establish a synchronized workspace.

                </p>

              </div>


              <div className="p-5 rounded-2xl bg-white/55 border border-slate-200 backdrop-blur-xl">

                <div className="text-indigo-600 font-bold text-sm mb-2">

                  02 — Create

                </div>

                <h3 className="text-base font-semibold text-slate-950 mb-2">

                  Draw and Animate

                </h3>

                <p className="text-sm leading-6 text-slate-500">

                  Create frame-by-frame animations using the drawing workspace, timeline, layers, and animation tools.

                </p>

              </div>


              <div className="p-5 rounded-2xl bg-white/55 border border-slate-200 backdrop-blur-xl">

                <div className="text-indigo-600 font-bold text-sm mb-2">

                  03 — Experience

                </div>

                <h3 className="text-base font-semibold text-slate-950 mb-2">

                  Use Both Screens

                </h3>

                <p className="text-sm leading-6 text-slate-500">

                  Keep your creative controls on one device while using another screen as your dedicated animation display.

                </p>

              </div>

            </div>

          </div>


          {/* What Duomation Is */}
          <div className="space-y-4">

            <h2 className="text-2xl font-bold text-slate-950">

              What Is Duomation?

            </h2>

            <p className="text-sm sm:text-base leading-7 text-slate-500 max-w-3xl">

              Duomation is a browser-based dual-device animation platform that connects multiple screens into a synchronized creative workflow. Its main purpose is to make two-device animation more practical by separating creation and display across connected devices.

            </p>

            <p className="text-sm sm:text-base leading-7 text-slate-500 max-w-3xl">

              It combines cross-device connectivity with digital drawing and frame-by-frame animation, giving creators a flexible workspace without requiring traditional desktop animation software.

            </p>

          </div>


          {/* Use Cases */}
          <div className="space-y-5">

            <h2 className="text-2xl font-bold text-slate-950">

              What Can You Use Duomation For?

            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {[
                "Dual-device animation workflows",
                "Frame-by-frame 2D animation",
                "Drawing animations in a browser",
                "Using a second device as an animation display",
                "Creating animations across connected screens",
                "Digital drawing and animation projects",
                "Previewing animation on a separate screen",
                "Portable animation workflows",
              ].map((item) => (

                <div
                  key={item}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/60 border border-slate-200 backdrop-blur-xl"
                >

                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />

                  <span className="text-sm text-slate-600">

                    {item}

                  </span>

                </div>

              ))}

            </div>

          </div>


          {/* FAQ */}
          <div className="space-y-5">

            <h2 className="text-2xl font-bold text-slate-950">

              Frequently Asked Questions

            </h2>

            <div className="space-y-3">

              <details className="group p-5 rounded-2xl bg-white/60 border border-slate-200 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  What is Duomation?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Duomation is a dual-device creative workspace that connects two devices into a synchronized animation workflow.

                </p>

              </details>


              <details className="group p-5 rounded-2xl bg-white/60 border border-slate-200 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  Can I use two devices with Duomation?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Yes. One device can be used as the drawing and animation workspace while another connected device can act as a dedicated display.

                </p>

              </details>


              <details className="group p-5 rounded-2xl bg-white/60 border border-slate-200 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  Is Duomation an animation tool?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Yes. Duomation provides a frame-by-frame animation workspace, but its defining feature is the ability to connect two devices into one animation workflow.

                </p>

              </details>


              <details className="group p-5 rounded-2xl bg-white/60 border border-slate-200 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  Does Duomation work in a browser?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Duomation is designed as a browser-based creative workspace, so you can access the application from compatible devices without installing traditional desktop animation software.

                </p>

              </details>

            </div>

          </div>

        </section>

      </div>


      <footer className="text-center text-xs text-slate-400 mt-12 mb-8 font-mono">

        Duomation Workstation • Latency-optimized 2D Animation Protocol

      </footer>

    </div>
  );
};