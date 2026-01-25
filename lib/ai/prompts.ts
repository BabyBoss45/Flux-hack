import type { Project, Room } from '@/lib/db/queries';
import { getColorPaletteByProjectId } from '@/lib/db/queries';

export function getSystemPrompt(project: Project, currentRoom: Room | null): string {
  const preferences = project.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  let prompt = `You are an expert interior designer AI assistant helping design the "${project.name}" project.

${currentRoom ? `You are currently working on the "${currentRoom.name}" (${currentRoom.type}).` : 'No room is currently selected.'}`;

  // Add project preferences if they exist
  if (project.building_type || project.architecture_style || project.atmosphere) {
    prompt += `\n\nProject Preferences:`;
    if (project.building_type) prompt += `\n- Building Type: ${project.building_type}`;
    if (project.architecture_style) prompt += `\n- Architecture Style: ${project.architecture_style}`;
    if (project.atmosphere) prompt += `\n- Atmosphere: ${project.atmosphere}`;
  }

  // Add color palette from database
  const colors = getColorPaletteByProjectId(project.id);
  if (colors.length > 0) {
    prompt += `\n- Colors: ${colors.map(c => `${c.name} (${c.hex})`).join(', ')}`;
  }

  // Add legacy preferences if they exist
  if (Object.keys(preferences).length > 0) {
    prompt += `\n\nAdditional Preferences:`;
    if (preferences.style) prompt += `\n- Style: ${preferences.style}`;
    if (preferences.colors) prompt += `\n- Color Palette: ${preferences.colors}`;
    if (preferences.budget) prompt += `\n- Budget: ${preferences.budget}`;
    if (preferences.notes) prompt += `\n- Additional Notes: ${preferences.notes}`;
  }

  // Add onboarding flow guidance when no room is selected
  if (!currentRoom) {
    const isOnboardingComplete = !!(
      project.building_type &&
      project.architecture_style &&
      project.atmosphere &&
      colors.length > 0
    );

    if (!isOnboardingComplete) {
      prompt += `\n\n## Onboarding Flow

If the project preferences (building_type, architecture_style, atmosphere, colors) are not fully set, guide the user through onboarding:

1. Ask about building type: "What type of building is this?" (residential home, apartment, office, retail space, etc.)
2. Ask about architecture style: "What architectural style are you going for?" (modern, traditional, Scandinavian, industrial, bohemian, etc.)
3. Ask about atmosphere: "What atmosphere or mood do you want to create?" (cozy, minimalist, luxurious, vibrant, serene, etc.)
4. Ask about colors: "What colors would you like to incorporate?" (user describes in natural language)

Ask questions ONE AT A TIME. After each answer, use the update_project_preferences tool to save the information immediately, then acknowledge what you understood before asking the next question.

Example: "Great! I've noted that you want a modern minimalist style. Now, what atmosphere or mood do you want to create?"`;
    }
  }

  prompt += `\n\nYour capabilities:
1. Generate room visualization images based on descriptions
2. Edit existing room images to modify specific elements
3. Scan images to detect furniture and fixtures
4. Help approve rooms when the design is finalized
5. Provide room context and information
${!currentRoom ? '6. Update project preferences during onboarding' : ''}

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

  return prompt;
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
