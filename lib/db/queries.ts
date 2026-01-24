import { queryOne, queryAll, execute, executeReturning } from './index';

// Types
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  floor_plan_url: string | null;
  global_preferences: string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: number;
  project_id: number;
  name: string;
  type: string;
  geometry: string;
  doors: string;
  windows: string;
  fixtures: string;
  adjacent_rooms: string;
  approved: number;
  created_at: string;
  updated_at: string;
}

export interface RoomImage {
  id: number;
  room_id: number;
  url: string;
  prompt: string;
  view_type: string;
  detected_items: string;
  created_at: string;
}

export interface Message {
  id: number;
  project_id: number;
  room_id: number | null;
  role: string;
  content: string;
  tool_calls: string;
  created_at: string;
}

export interface SharedDesign {
  id: string;
  project_id: number;
  created_at: string;
}

// User queries
export function getUserById(id: number): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
}

export function getUserByEmail(email: string): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE email = ?', [email]);
}

export function createUser(email: string, name: string): User | undefined {
  return executeReturning<User>(
    'INSERT INTO users (email, name) VALUES (?, ?) RETURNING *',
    [email, name]
  );
}

// Project queries
export function getProjectById(id: number): Project | undefined {
  return queryOne<Project>('SELECT * FROM projects WHERE id = ?', [id]);
}

export function getProjectsByUserId(userId: number): Project[] {
  return queryAll<Project>(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [userId]
  );
}

export function createProject(
  userId: number,
  name: string,
  floorPlanUrl?: string
): Project | undefined {
  return executeReturning<Project>(
    'INSERT INTO projects (user_id, name, floor_plan_url) VALUES (?, ?, ?) RETURNING *',
    [userId, name, floorPlanUrl || null]
  );
}

export function updateProject(
  id: number,
  data: Partial<{ name: string; floor_plan_url: string; global_preferences: string }>
): void {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.floor_plan_url !== undefined) {
    updates.push('floor_plan_url = ?');
    params.push(data.floor_plan_url);
  }
  if (data.global_preferences !== undefined) {
    updates.push('global_preferences = ?');
    params.push(data.global_preferences);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

export function deleteProject(id: number): void {
  execute('DELETE FROM projects WHERE id = ?', [id]);
}

// Room queries
export function getRoomById(id: number): Room | undefined {
  return queryOne<Room>('SELECT * FROM rooms WHERE id = ?', [id]);
}

export function getRoomsByProjectId(projectId: number): Room[] {
  return queryAll<Room>('SELECT * FROM rooms WHERE project_id = ? ORDER BY id', [projectId]);
}

export function createRoom(
  projectId: number,
  name: string,
  type: string,
  data?: Partial<{ geometry: string; doors: string; windows: string; fixtures: string; adjacent_rooms: string }>
): Room | undefined {
  return executeReturning<Room>(
    `INSERT INTO rooms (project_id, name, type, geometry, doors, windows, fixtures, adjacent_rooms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      projectId,
      name,
      type,
      data?.geometry || '{}',
      data?.doors || '[]',
      data?.windows || '[]',
      data?.fixtures || '[]',
      data?.adjacent_rooms || '[]',
    ]
  );
}

export function updateRoom(
  id: number,
  data: Partial<{
    name: string;
    type: string;
    geometry: string;
    doors: string;
    windows: string;
    fixtures: string;
    adjacent_rooms: string;
    approved: number;
  }>
): void {
  const updates: string[] = [];
  const params: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');
    params.push(data.type);
  }
  if (data.geometry !== undefined) {
    updates.push('geometry = ?');
    params.push(data.geometry);
  }
  if (data.doors !== undefined) {
    updates.push('doors = ?');
    params.push(data.doors);
  }
  if (data.windows !== undefined) {
    updates.push('windows = ?');
    params.push(data.windows);
  }
  if (data.fixtures !== undefined) {
    updates.push('fixtures = ?');
    params.push(data.fixtures);
  }
  if (data.adjacent_rooms !== undefined) {
    updates.push('adjacent_rooms = ?');
    params.push(data.adjacent_rooms);
  }
  if (data.approved !== undefined) {
    updates.push('approved = ?');
    params.push(data.approved);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);
    execute(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, params);
  }
}

export function approveRoom(id: number): void {
  execute("UPDATE rooms SET approved = 1, updated_at = datetime('now') WHERE id = ?", [id]);
}

export function deleteRoom(id: number): void {
  execute('DELETE FROM rooms WHERE id = ?', [id]);
}

// Room image queries
export function getRoomImagesByRoomId(roomId: number): RoomImage[] {
  // Explicitly select all columns to ensure detected_items is included
  const images = queryAll<RoomImage>(
    'SELECT id, room_id, url, prompt, view_type, detected_items, created_at FROM room_images WHERE room_id = ? ORDER BY created_at DESC',
    [roomId]
  );
  
  // Normalize detected_items:
  // null/undefined = use default '[]' (detection not run yet)
  // 'null' = detection failed (sentinel value)
  // '[]' = detection succeeded but found no objects
  // '[{...}]' = detection succeeded with objects
  const normalizedImages = images.map((img) => ({
    ...img,
    detected_items: img.detected_items ?? '[]',
  }));
  
  // Debug: Log raw database results
  console.log('=== RAW DB QUERY RESULTS ===');
  normalizedImages.forEach((img, index) => {
    console.log(`Raw DB Image ${index}:`, JSON.stringify(img, null, 2));
    console.log(`detected_items check:`, {
      exists: 'detected_items' in img,
      value: img.detected_items,
      type: typeof img.detected_items,
      isNull: img.detected_items === null,
      isUndefined: img.detected_items === undefined,
    });
  });
  
  return normalizedImages;
}

export function createRoomImage(
  roomId: number,
  url: string,
  prompt: string,
  viewType: string = 'perspective',
  detectedItems: string | null = null
): RoomImage | undefined {
  // Handle detection states:
  // null/undefined = detection not run or failed → save as 'null' string (sentinel value)
  // '[]' = detection succeeded but found no objects (valid empty result)
  // '[{...}]' = detection succeeded and found objects
  // Never save '[]' when detection failed - use 'null' string instead
  const normalizedDetectedItems = detectedItems !== null && detectedItems !== undefined 
    ? detectedItems 
    : 'null';
  
  // Debug: Log what we're saving
  console.log('=== CREATING ROOM IMAGE ===');
  console.log('detectedItems being saved:', {
    value: normalizedDetectedItems,
    type: typeof normalizedDetectedItems,
    length: normalizedDetectedItems.length,
  });
  
  // SQLite doesn't support RETURNING in older versions, so insert then query
  execute(
    'INSERT INTO room_images (room_id, url, prompt, view_type, detected_items) VALUES (?, ?, ?, ?, ?)',
    [roomId, url, prompt, viewType, normalizedDetectedItems]
  );
  
  // Get the last inserted row
  const result = queryOne<RoomImage>(
    'SELECT id, room_id, url, prompt, view_type, detected_items, created_at FROM room_images WHERE id = last_insert_rowid()'
  );
  
  // Debug: Log what was returned
  if (result) {
    console.log('=== CREATED ROOM IMAGE RESULT ===');
    console.log('Returned image:', {
      id: result.id,
      detected_items: result.detected_items,
      detected_items_type: typeof result.detected_items,
      all_keys: Object.keys(result),
    });
    
    // Ensure detected_items is present
    if (!result.detected_items) {
      console.warn('WARNING: detected_items missing from created image, updating...');
      updateRoomImageItems(result.id, normalizedDetectedItems);
      result.detected_items = normalizedDetectedItems;
    }
  }
  
  return result;
}

export function updateRoomImageItems(id: number, detectedItems: string): void {
  execute('UPDATE room_images SET detected_items = ? WHERE id = ?', [detectedItems, id]);
}

// Message queries
export function getMessagesByProjectId(projectId: number): Message[] {
  return queryAll<Message>(
    'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC',
    [projectId]
  );
}

export function getMessagesByRoomId(roomId: number): Message[] {
  return queryAll<Message>(
    'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at ASC',
    [roomId]
  );
}

export function createMessage(
  projectId: number,
  role: string,
  content: string,
  roomId?: number,
  toolCalls?: string
): Message | undefined {
  return executeReturning<Message>(
    'INSERT INTO messages (project_id, room_id, role, content, tool_calls) VALUES (?, ?, ?, ?, ?) RETURNING *',
    [projectId, roomId || null, role, content, toolCalls || '[]']
  );
}

// Shared design queries
export function getSharedDesignById(id: string): SharedDesign | undefined {
  return queryOne<SharedDesign>('SELECT * FROM shared_designs WHERE id = ?', [id]);
}

export function getSharedDesignByProjectId(projectId: number): SharedDesign | undefined {
  return queryOne<SharedDesign>('SELECT * FROM shared_designs WHERE project_id = ?', [projectId]);
}

export function createSharedDesign(id: string, projectId: number): SharedDesign | undefined {
  return executeReturning<SharedDesign>(
    'INSERT INTO shared_designs (id, project_id) VALUES (?, ?) RETURNING *',
    [id, projectId]
  );
}

export function deleteSharedDesign(id: string): void {
  execute('DELETE FROM shared_designs WHERE id = ?', [id]);
}

// Helper to check if all rooms are approved
export function areAllRoomsApproved(projectId: number): boolean {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM rooms WHERE project_id = ? AND approved = 0',
    [projectId]
  );
  return result?.count === 0;
}

// Get full project with rooms and images
export function getProjectWithRoomsAndImages(projectId: number): {
  project: Project;
  rooms: (Room & { images: RoomImage[] })[];
} | null {
  const project = getProjectById(projectId);
  if (!project) return null;

  const rooms = getRoomsByProjectId(projectId);
  const roomsWithImages = rooms.map((room) => ({
    ...room,
    images: getRoomImagesByRoomId(room.id),
  }));

  return { project, rooms: roomsWithImages };
}
