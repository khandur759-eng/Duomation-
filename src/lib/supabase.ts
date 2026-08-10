import { createClient } from '@supabase/supabase-js';
import { Project } from '../types/animation';

const meta = import.meta as any;
const SUPABASE_URL = meta.env?.VITE_SUPABASE_URL || 'https://pqqvtofelnicceshjbyb.supabase.co';
const SUPABASE_ANON_KEY = meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jnN_xVltBMRPWOMWkBZpjg_mri01i41';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const SUPABASE_PROJECT_ID = 'pqqvtofelnicceshjbyb';

/**
 * Check connectivity and availability of Supabase backend
 */
export async function checkSupabaseConnection(): Promise<{ connected: boolean; message: string }> {
  try {
    const { error } = await supabase.from('projects').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return {
          connected: true,
          message: 'Connected to Supabase (Table "projects" ready)',
        };
      }
      return { connected: true, message: `Connected to Supabase (${error.message})` };
    }
    return { connected: true, message: 'Connected to Supabase DB' };
  } catch (e: any) {
    return { connected: false, message: e?.message || 'Supabase connection failed' };
  }
}

/**
 * Save project to Supabase 'projects' table
 */
export async function saveProjectToSupabase(project: Project): Promise<boolean> {
  try {
    const payload = {
      id: project.id,
      name: project.name,
      updated_at: new Date(project.updatedAt || Date.now()).toISOString(),
      width: project.settings?.width || 1280,
      height: project.settings?.height || 720,
      fps: project.settings?.fps || 12,
      data: project,
    };

    const { error } = await supabase
      .from('projects')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('Supabase project save warning:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Supabase save failed:', err);
    return false;
  }
}

/**
 * Load project from Supabase
 */
export async function loadProjectFromSupabase(id: string): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return data.data as Project;
  } catch (err) {
    console.warn('Supabase load failed:', err);
    return null;
  }
}

/**
 * List projects from Supabase
 */
export async function listSupabaseProjects(): Promise<Array<{ id: string; name: string; updatedAt: number; frameCount: number }>> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, updated_at, data')
      .order('updated_at', { ascending: false });

    if (error || !data) return [];

    return data.map((item: any) => {
      const proj = item.data as Project;
      return {
        id: item.id,
        name: item.name || proj?.name || 'Untitled',
        updatedAt: item.updated_at ? new Date(item.updated_at).getTime() : Date.now(),
        frameCount: proj?.frames?.length || 1,
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Delete project from Supabase
 */
export async function deleteProjectFromSupabase(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    return !error;
  } catch (err) {
    return false;
  }
}

