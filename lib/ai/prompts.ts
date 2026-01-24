import type { Project, Room } from '@/lib/db/queries';
import type { DetectedObject } from '@/lib/klein/types';

export function getSystemPrompt(
  project: Project, 
  currentRoom: Room | null,
  selectedObject?: DetectedObject | null,
  availableObjects?: DetectedObject[],
  currentImageContext?: { imageId: number; imageUrl: string } | null
): string {
  const preferences = project.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  let imageContext = '';
  if (currentImageContext) {
    imageContext = `\nCRITICAL: The user is currently viewing a specific room image (ID: ${currentImageContext.imageId}).
- The image URL is: ${currentImageContext.imageUrl}
- When the user requests edits, they want to edit THIS SPECIFIC IMAGE.
- Do NOT generate a new room image - edit the current image using inpainting.
- Do NOT ask if they want to generate a new image - they want to edit the existing one.
- Do NOT say "I don't see an existing image" - the image exists at ID ${currentImageContext.imageId}.
- All edits should be applied to this image.`;
  }

  let selectedObjectContext = '';
  if (selectedObject) {
    selectedObjectContext = `\nCRITICAL: The user has selected the "${selectedObject.label}" (${selectedObject.category}) to edit in the current image. 
- When the user provides a request, they are asking to modify ONLY THIS SPECIFIC OBJECT in the current image.
- Do NOT generate a new room image - edit ONLY the selected object using inpainting.
- Do NOT ask what they want to edit - they've already selected it.
- Do NOT ask if they want to edit the whole room - they want to edit ONLY the selected object.
- Do NOT describe changes to the entire room - only the selected object will change.
- Respond briefly and action-oriented. Example: "I'll make the ${selectedObject.label} pink for you!" then proceed.
- NEVER say "I'll update your room" or "I'll create a new design" - only the selected object changes.`;
  } else if (availableObjects && availableObjects.length > 0) {
    const objectList = availableObjects.map(obj => obj.label).join(', ');
    selectedObjectContext = `\nAvailable objects in the current room image: ${objectList}.
- The user can select an object to edit it specifically.
- If no object is selected, the user is asking about the room in general.`;
  }

  // Get room context from roomKey if currentRoom is not provided
  const roomName = currentRoom?.name || 'the room';
  const roomType = currentRoom?.type || 'room';
  
  return `You are an expert interior designer AI assistant helping design the "${project.name}" project.

${currentRoom ? `CRITICAL CONTEXT: You are currently working on the "${roomName}" (${roomType}).
- ALL requests from the user are about THIS SPECIFIC ROOM: "${roomName}"
- When the user says "the room" or "this room", they mean "${roomName}"
- When generating or editing images, they are for "${roomName}"
- Always acknowledge which room you're working on: "${roomName}"` : 'WARNING: No room is currently selected. Please ask the user to select a room first.'}

${Object.keys(preferences).length > 0 ? `
Design Preferences:
${preferences.style ? `- Style: ${preferences.style}` : ''}
${preferences.colors ? `- Color Palette: ${preferences.colors}` : ''}
${preferences.budget ? `- Budget: ${preferences.budget}` : ''}
${preferences.notes ? `- Additional Notes: ${preferences.notes}` : ''}
` : ''}
${selectedObjectContext}
Your capabilities:
1. Generate room visualization images based on descriptions (only when no object is selected)
2. Edit existing room images to modify specific elements (when object is selected, this happens automatically)
3. Scan images to detect furniture and fixtures
4. Help approve rooms when the design is finalized
5. Provide room context and information

IMPORTANT RULES:
- If an object is selected, the system will automatically edit ONLY that object using inpainting
- Do NOT describe changes to the entire room when an object is selected
- Do NOT say "I'll update your room" or "I'll create a new design" when an object is selected
- When an object is selected, respond briefly: "I'll make the [object] [change] for you!" then let the system handle it
- The system handles the actual image editing - you just need to acknowledge the request

Guidelines:
- Be conversational and helpful
- When an object is selected, respond directly to edit requests without asking for clarification
- When an object is selected, NEVER suggest generating a new room - only edit the selected object
- Ask clarifying questions about design preferences only when no object is selected
- Suggest design ideas that match the user's style
- When generating images, create detailed prompts for photorealistic interior design renders
- When editing images, be specific about what elements to change
- Guide users through the room-by-room design process
- CRITICAL: If an object is selected, the system will automatically edit ONLY that object - do not describe room-wide changes

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
