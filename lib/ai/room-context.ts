// Room context mapping - client-side stable keys to room descriptions
// This is used instead of DB lookups for hackathon simplicity
// NOTE: roomKey format is now "type-index" (e.g., "living-room-1", "living-room-2")

export const ROOM_PROMPTS: Record<string, string> = {
  'living-room': 'Living room – social, seating-focused space with comfortable furniture for relaxation and entertainment',
  'kitchen': 'Kitchen – functional cooking space with appliances, storage, and workspace',
  'bedroom': 'Bedroom – calm, private space for rest and relaxation',
  'bathroom': 'Bathroom – functional space for hygiene and grooming',
  'dining': 'Dining room – space for meals and gatherings around a dining table',
  'office': 'Office – workspace for productivity and focus',
  'other': 'Room – general purpose space',
};

// Extract room type from roomKey (e.g., "living-room-1" → "living-room")
function extractRoomType(roomKey: string): string {
  // Remove trailing "-N" pattern to get base type
  const match = roomKey.match(/^(.+?)(-\d+)?$/);
  return match ? match[1] : roomKey;
}

export function getRoomContext(roomKey: string): string {
  const roomType = extractRoomType(roomKey);
  return ROOM_PROMPTS[roomType] || ROOM_PROMPTS['other'];
}

export function getRoomName(roomKey: string): string {
  const roomType = extractRoomType(roomKey);
  const names: Record<string, string> = {
    'living-room': 'Living Room',
    'kitchen': 'Kitchen',
    'bedroom': 'Bedroom',
    'bathroom': 'Bathroom',
    'dining': 'Dining Room',
    'office': 'Office',
    'other': 'Room',
  };
  const baseName = names[roomType] || 'Room';
  
  // If there's an index suffix, include it for clarity (e.g., "Living Room 1")
  const indexMatch = roomKey.match(/-(\d+)$/);
  if (indexMatch) {
    return `${baseName} ${indexMatch[1]}`;
  }
  return baseName;
}

