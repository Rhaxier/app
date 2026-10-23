// School map: floors and rooms. Everyone reads them; only admins change them
// (supabase/migrations/20261019120300_map.sql). Other features use the room
// list too (volunteering places, venues, fix-it reports).
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Floor = Pick<
  Tables<'floors'>,
  'id' | 'name' | 'sort_order' | 'image_path' | 'width' | 'height'
>;
export type Room = Pick<Tables<'rooms'>, 'id' | 'floor_id' | 'code' | 'name' | 'kind' | 'x' | 'y'>;

export async function fetchFloors(): Promise<Floor[]> {
  const { data, error } = await supabase
    .from('floors')
    .select('id, name, sort_order, image_path, width, height')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchRooms(): Promise<Room[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, floor_id, code, name, kind, x, y')
    .order('code');
  if (error) throw error;
  return data;
}

// Admin map editor (RLS: admins only; every change is audited).
export async function createRoom(room: TablesInsert<'rooms'>): Promise<void> {
  const { error } = await supabase.from('rooms').insert(room);
  if (error) throw error;
}

export async function updateRoom(id: string, changes: TablesUpdate<'rooms'>): Promise<void> {
  const { error } = await supabase.from('rooms').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteRoom(id: string): Promise<void> {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) throw error;
}

export async function updateFloor(id: string, changes: TablesUpdate<'floors'>): Promise<void> {
  const { error } = await supabase.from('floors').update(changes).eq('id', id);
  if (error) throw error;
}

/**
 * Admin: upload a new floor plan image to the public `floor-plans` bucket and
 * return its address plus its size in pixels (pins are placed in pixels).
 * Saving the floor with these values is a separate step (updateFloor).
 */
export async function uploadFloorPlan(
  floorId: string,
  file: File,
): Promise<{ url: string; width: number; height: number }> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
  // A new name each time, so browsers don't keep showing a cached old plan.
  const path = `floors/${floorId}/plan-${Date.now()}.${extension}`;
  const upload = await supabase.storage
    .from('floor-plans')
    .upload(path, file, { contentType: file.type });
  if (upload.error) throw upload.error;
  const { data } = supabase.storage.from('floor-plans').getPublicUrl(path);
  const size = await imageSize(data.publicUrl);
  return { url: data.publicUrl, ...size };
}

function imageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The image uploaded but couldn't be opened."));
    image.src = url;
  });
}
