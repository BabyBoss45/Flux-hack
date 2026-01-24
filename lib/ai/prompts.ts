import type { Project, Room } from '@/lib/db/queries';

export function getSystemPrompt(project: Project, currentRoom: Room | null): string {
  const preferences = project.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  return `You are an expert interior designer AI assistant helping design the "${project.name}" project.

${currentRoom ? `You are currently working on the "${currentRoom.name}" (${currentRoom.type}).` : 'No room is currently selected.'}

${Object.keys(preferences).length > 0 ? `
Design Preferences:
${preferences.style ? `- Style: ${preferences.style}` : ''}
${preferences.colors ? `- Color Palette: ${preferences.colors}` : ''}
${preferences.budget ? `- Budget: ${preferences.budget}` : ''}
${preferences.notes ? `- Additional Notes: ${preferences.notes}` : ''}
` : ''}

Your capabilities:
1. Generate room visualization images based on descriptions
2. Edit existing room images to modify specific elements
3. Scan images to detect furniture and fixtures
4. Help approve rooms when the design is finalized
5. Provide room context and information

Guidelines:
- Be conversational and helpful
- Ask clarifying questions about design preferences
- Suggest design ideas that match the user's style
- When generating images, create detailed prompts for photorealistic interior design renders
- When editing images, be specific about what elements to change
- Guide users through the room-by-room design process

When generating images, enhance the user's description with:
- Lighting details (natural light, ambient lighting)
- Material textures (wood, fabric, metal finishes)
- Spatial composition
- Style-appropriate furniture and decor
- Photorealistic quality descriptors`;
}

export function getRoomContextPrompt(room: Room): string {
  const geometry = JSON.parse(room.geometry);
  const doors = JSON.parse(room.doors);
  const windows = JSON.parse(room.windows);
  const fixtures = JSON.parse(room.fixtures);
  const adjacentRooms = JSON.parse(room.adjacent_rooms);

  return `Room Details for "${room.name}":
- Type: ${room.type}
- Approved: ${room.approved ? 'Yes' : 'No'}
${geometry.width && geometry.height ? `- Dimensions: ${geometry.width} x ${geometry.height}` : ''}
${doors.length > 0 ? `- Doors: ${doors.length}` : ''}
${windows.length > 0 ? `- Windows: ${windows.length}` : ''}
${fixtures.length > 0 ? `- Fixed Elements: ${fixtures.join(', ')}` : ''}
${adjacentRooms.length > 0 ? `- Adjacent Rooms: ${adjacentRooms.join(', ')}` : ''}`;
}

export function buildImagePrompt(
  userDescription: string,
  room: Room,
  preferences: Record<string, string>
): string {
  const style = preferences.style || 'modern';
  const colors = preferences.colors || 'neutral tones';

  return `Photorealistic interior design render of a ${room.type.toLowerCase()} in ${style} style. ${userDescription}.
Color palette: ${colors}.
Professional interior photography, high-end finishes, natural lighting through windows,
detailed textures on furniture and fabrics, 8K resolution, architectural visualization quality.`;
}
