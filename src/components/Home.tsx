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
    // Optimistically update UI immediately for instant single-click deletion
    setRecentProjects((prev) => prev.filter((p) => p.id !== id));
    await deleteProject(id);
    await reloadProjects();
  };

  const handleClearAll = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistically update UI immediately for instant single-click deletion
    setRecentProjects([]);
    await deleteAllProjects();
    await reloadProjects();
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
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-[#f6f7fb] text-slate-950 selection:bg-indigo-200 selection:text-indigo-950">

      {/* Premium background atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-52 -left-40 h-[32rem] w-[32rem] rounded-full bg-indigo-300/25 blur-3xl" />

        <div className="absolute top-20 right-[-12rem] h-[34rem] w-[34rem] rounded-full bg-violet-300/20 blur-3xl" />

        <div className="absolute bottom-[-14rem] left-1/3 h-[30rem] w-[30rem] rounded-full bg-fuchsia-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 md:px-12 lg:px-16">

        {/* ================= HEADER ================= */}

        <header className="flex items-center justify-between gap-4 mb-16 sm:mb-20">

          <div className="flex items-center gap-3 sm:gap-4">

            <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 text-xl sm:text-2xl font-black text-white shadow-xl shadow-indigo-500/25">
              D
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-[-0.035em] text-slate-950">
                Duomation
              </h1>

              <p className="font-mono text-xs sm:text-sm tracking-tight text-slate-500">
                2D Animation Workstation
              </p>
            </div>

          </div>

          {/* Existing controls intentionally remain hidden,
              exactly as in the original implementation. */}

          <div className="hidden items-center gap-2">

            <div
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-mono text-emerald-600"
              title={`Supabase Project ID: ${SUPABASE_PROJECT_ID}`}
            >
              <Database className="h-3.5 w-3.5" />

              <span>
                Supabase Cloud Sync
              </span>

              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>

            <label className="cursor-pointer flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300">

              <Upload className="h-4 w-4 text-slate-500" />

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


        {/* ================= HERO ================= */}

        <section className="space-y-9">

          <div className="max-w-4xl space-y-5">

            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/75 px-4 py-2 text-xs sm:text-sm font-semibold text-indigo-600 shadow-sm backdrop-blur-xl">

              <Sparkles className="h-4 w-4" />

              Two-Device Synchronized Workstation

            </span>


            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.97] tracking-[-0.06em] text-slate-950">

              Animate effortlessly across{' '}

              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">

                two screens.

              </span>

            </h2>


            <p className="max-w-2xl text-base sm:text-lg lg:text-xl leading-8 text-slate-500">

              Turn device A into a precision tablet drawing controller and device B into a full-screen dedicated animation display monitor.

            </p>

          </div>


          {/* ================= PRIMARY ACTIONS ================= */}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

            {/* CREATE ANIMATION */}

            <button
              onClick={onCreateProject}
              className="group relative flex min-h-48 sm:min-h-52 flex-col justify-between overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 p-6 sm:p-7 text-left text-white shadow-2xl shadow-indigo-500/25 transition-all hover:from-indigo-500 hover:via-violet-500 hover:to-fuchsia-400 active:scale-[0.99]"
            >

              <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/20 blur-2xl transition-transform group-hover:scale-125" />

              <div className="relative flex items-start justify-between">

                <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-md ring-1 ring-white/20">

                  <Smartphone className="h-6 w-6 text-white" />

                </div>


                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider backdrop-blur-md ring-1 ring-white/20">

                  Device A (Draw)

                </span>

              </div>


              <div className="relative">

                <h3 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-white transition-transform group-hover:translate-x-1">

                  Create Animation

                  <Plus className="h-5 w-5 sm:h-6 sm:w-6" />

                </h3>

                <p className="mt-2 text-sm text-indigo-50/90">

                  Start drawing & edit frame timeline on this device.

                </p>

              </div>

            </button>


            {/* DISPLAY MONITOR */}

            <button
              onClick={() => onJoinSession('display')}
              className="group relative flex min-h-48 sm:min-h-52 flex-col justify-between overflow-hidden rounded-[2rem] border border-slate-200 bg-white/75 p-6 sm:p-7 text-left text-slate-950 shadow-xl shadow-slate-200/40 backdrop-blur-xl transition-all hover:border-indigo-200 hover:bg-white active:scale-[0.99]"
            >

              <div className="absolute -bottom-20 -right-16 h-44 w-44 rounded-full bg-indigo-100/60 blur-3xl transition-colors group-hover:bg-violet-100/70" />


              <div className="relative flex items-start justify-between">

                <div className="rounded-2xl bg-slate-100 p-3 text-indigo-600 ring-1 ring-slate-200">

                  <Monitor className="h-6 w-6" />

                </div>


                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-slate-500">

                  Device B (Display)

                </span>

              </div>


              <div className="relative">

                <h3 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 transition-transform group-hover:translate-x-1">

                  Connect Display Monitor

                </h3>

                <p className="mt-2 text-sm text-slate-500">

                  Scan QR code or enter code to use this screen as a live monitor.

                </p>

              </div>

            </button>

          </div>

        </section>


        {/* ================= RECENT PROJECTS ================= */}

        <section className="mt-20 space-y-5 border-t border-slate-200/80 pt-8">

          <div className="flex items-center justify-between gap-3">

            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-600">

              <FolderOpen className="h-4 w-4 text-indigo-500" />

              Recent Projects ({recentProjects.length})

            </h3>


            {recentProjects.length > 0 && (

              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-100 hover:text-rose-600"
                title="Delete all recent projects"
              >

                <Trash2 className="h-3.5 w-3.5" />

                <span>
                  Clear All Projects
                </span>

              </button>

            )}

          </div>


          {recentProjects.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white/45 p-10 text-center text-xs text-slate-400 shadow-sm">

              No recent animation projects stored on this device.

            </div>

          ) : (

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">

              {recentProjects.map((proj) => (

                <div
                  key={proj.id}
                  className="group relative flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:border-indigo-200 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/40"
                >

                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => onOpenProject(proj.id)}
                  >

                    <div className="space-y-1 truncate pr-2">

                      <h4 className="truncate text-sm font-semibold text-slate-800 group-hover:text-slate-950">

                        {proj.name}

                      </h4>

                      <p className="font-mono text-[11px] text-slate-400">

                        {proj.frameCount} frame(s) • {new Date(proj.updatedAt).toLocaleDateString()}

                      </p>

                    </div>

                  </div>


                  <button
                    onClick={(e) => handleDelete(e, proj.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500"
                    title="Delete Project"
                  >

                    <Trash2 className="h-4 w-4" />

                  </button>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* ================= SEO / PRODUCT INFORMATION ================= */}

        <section className="mt-20 space-y-12 border-t border-slate-200/80 pt-10">


          {/* MAIN DESCRIPTION */}

          <div className="max-w-3xl space-y-4">

            <span className="inline-flex rounded-full border border-indigo-100 bg-white/75 px-4 py-2 text-xs font-semibold text-indigo-600 shadow-sm backdrop-blur-xl">

              Dual-Device Creative Workspace

            </span>


            <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.04em] text-slate-950">

              Connect Two Devices. Create as One.

            </h2>


            <p className="text-sm sm:text-base leading-7 text-slate-500">

              Duomation is a dual-device creative workspace designed to connect two devices into one synchronized animation workflow. Use one device as your drawing and animation controller while another device becomes a dedicated display screen. Duomation brings both screens together so you can create, preview, and work with animations across devices directly in your browser.

            </p>

          </div>


          {/* DEVICE WORKFLOW */}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <div className="rounded-3xl border border-slate-200 bg-white/65 p-6 sm:p-7 shadow-lg shadow-slate-200/30 backdrop-blur-xl">

              <div className="mb-4 flex items-center gap-3">

                <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">

                  <Smartphone className="h-5 w-5" />

                </div>

                <h3 className="text-lg font-semibold text-slate-950">

                  Device A — Create

                </h3>

              </div>


              <p className="text-sm leading-6 text-slate-500">

                Use your primary device as a drawing and animation workspace. Create frames, draw your artwork, edit your animation timeline, manage layers, and control your animation from one screen.

              </p>

            </div>


            <div className="rounded-3xl border border-slate-200 bg-white/65 p-6 sm:p-7 shadow-lg shadow-slate-200/30 backdrop-blur-xl">

              <div className="mb-4 flex items-center gap-3">

                <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">

                  <Monitor className="h-5 w-5" />

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


          {/* HOW IT WORKS */}

          <div className="space-y-5">

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">

              How Duomation Works

            </h2>


            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

              {[
                {
                  number: '01 — Connect',
                  title: 'Connect Two Devices',
                  text: 'Pair your devices using the Duomation connection system and establish a synchronized workspace.'
                },
                {
                  number: '02 — Create',
                  title: 'Draw and Animate',
                  text: 'Create frame-by-frame animations using the drawing workspace, timeline, layers, and animation tools.'
                },
                {
                  number: '03 — Experience',
                  title: 'Use Both Screens',
                  text: 'Keep your creative controls on one device while using another screen as your dedicated animation display.'
                }
              ].map((item) => (

                <div
                  key={item.number}
                  className="rounded-2xl border border-slate-200 bg-white/55 p-5 backdrop-blur-xl"
                >

                  <div className="mb-2 text-sm font-bold text-indigo-600">

                    {item.number}

                  </div>

                  <h3 className="mb-2 text-base font-semibold text-slate-950">

                    {item.title}

                  </h3>

                  <p className="text-sm leading-6 text-slate-500">

                    {item.text}

                  </p>

                </div>

              ))}

            </div>

          </div>


          {/* WHAT IS DUOMATION */}

          <div className="max-w-3xl space-y-4">

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950">

              What Is Duomation?

            </h2>


            <p className="text-sm sm:text-base leading-7 text-slate-500">

              Duomation is a browser-based dual-device animation platform that connects multiple screens into a synchronized creative workflow. Its main purpose is to make two-device animation more practical by separating creation and display across connected devices.

            </p>


            <p className="text-sm sm:text-base leading-7 text-slate-500">

              It combines cross-device connectivity with digital drawing and frame-by-frame animation, giving creators a flexible workspace without requiring traditional desktop animation software.

            </p>

          </div>


          {/* USE CASES */}

          <div className="space-y-5">

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950">

              What Can You Use Duomation For?

            </h2>


            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {[
                'Dual-device animation workflows',
                'Frame-by-frame 2D animation',
                'Drawing animations in a browser',
                'Using a second device as an animation display',
                'Creating animations across connected screens',
                'Digital drawing and animation projects',
                'Previewing animation on a separate screen',
                'Portable animation workflows',
              ].map((item) => (

                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/60 p-4 backdrop-blur-xl"
                >

                  <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />

                  <span className="text-sm text-slate-600">

                    {item}

                  </span>

                </div>

              ))}

            </div>

          </div>


          {/* FAQ */}

          <div className="space-y-5">

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-950">

              Frequently Asked Questions

            </h2>


            <div className="space-y-3">


              <details className="group rounded-2xl border border-slate-200 bg-white/60 p-5 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  What is Duomation?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Duomation is a dual-device creative workspace that connects two devices into a synchronized animation workflow.

                </p>

              </details>


              <details className="group rounded-2xl border border-slate-200 bg-white/60 p-5 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  Can I use two devices with Duomation?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Yes. One device can be used as the drawing and animation workspace while another connected device can act as a dedicated display.

                </p>

              </details>


              <details className="group rounded-2xl border border-slate-200 bg-white/60 p-5 backdrop-blur-xl">

                <summary className="cursor-pointer text-sm font-semibold text-slate-950">

                  Is Duomation an animation tool?

                </summary>

                <p className="mt-3 text-sm leading-6 text-slate-500">

                  Yes. Duomation provides a frame-by-frame animation workspace, but its defining feature is the ability to connect two devices into one animation workflow.

                </p>

              </details>


              <details className="group rounded-2xl border border-slate-200 bg-white/60 p-5 backdrop-blur-xl">

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


      {/* ================= FOOTER ================= */}

      <footer className="relative mt-4 mb-8 px-5 text-center font-mono text-xs text-slate-400">

        Duomation Workstation • Latency-optimized 2D Animation Protocol

      </footer>

    </div>
  );
};
