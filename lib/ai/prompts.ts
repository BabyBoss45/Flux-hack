import type { Project, Room } from '@/lib/db/queries';
import { getColorPaletteByProjectId } from '@/lib/db/queries';

// Types for structured prompt building
export interface RoomGeometry {
  length_m?: number;
  width_m?: number;
  height_m?: number;
  area_sqm?: number;
}

export interface WindowInfo {
  wall: string;
  type?: string;
  count?: number;
}

export interface DoorInfo {
  wall: string;
  leads_to?: string;
  type?: string;
}

export type ViewType = 'main' | 'alternate_angle' | 'variation';

// View type camera angle instructions
export const VIEW_TYPE_CAMERA_ANGLES: Record<ViewType, string> = {
  main: 'Eye-level view from the entrance, showcasing the full room',
  alternate_angle: 'Corner perspective view, showing depth and adjacent walls',
  variation: 'Alternative styling variation, same camera angle as previous',
};

// Quality modifiers for BFL best practices
const QUALITY_MODIFIERS = [
  'photorealistic',
  'interior design magazine quality',
  'professional photography',
  'natural lighting',
  'high resolution',
  'detailed textures',
];

/**
 * Calculate room-adaptive resolution based on room dimensions
 */
export function calculateAspectRatio(geometry: RoomGeometry): { width: number; height: number } {
  const length = geometry.length_m || 5;
  const width = geometry.width_m || 4;
  const ratio = length / width;

  // Map to BFL supported resolutions
  if (ratio >= 1.7) return { width: 1920, height: 1080 }; // 16:9 landscape
  if (ratio >= 1.3) return { width: 1536, height: 1024 }; // 3:2 landscape
  if (ratio >= 0.9) return { width: 1024, height: 1024 }; // 1:1 square
  if (ratio >= 0.7) return { width: 1024, height: 1536 }; // 3:2 portrait
  return { width: 1080, height: 1920 }; // 16:9 portrait
}

/**
 * Enhance a prompt with BFL quality modifiers
 */
export function enhancePrompt(basePrompt: string): string {
  return `${basePrompt}. ${QUALITY_MODIFIERS.join(', ')}.`;
}

/**
 * Sanitize prompt for retry after errors
 */
export function sanitizePrompt(prompt: string): string {
  // Remove potentially problematic terms
  let sanitized = prompt
    .replace(/\b(explicit|violent|graphic|nsfw)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Truncate if too long (BFL limit is typically 2000 chars)
  if (sanitized.length > 1800) {
    sanitized = sanitized.substring(0, 1800) + '...';
  }

  return sanitized;
}

/**
 * Build window description from window data
 */
function buildWindowDescription(windows: WindowInfo[]): string {
  if (!windows || windows.length === 0) {
    return 'No windows';
  }

  const windowsByWall = windows.reduce(
    (acc, w) => {
      const wall = w.wall || 'unknown';
      if (!acc[wall]) acc[wall] = 0;
      acc[wall] += w.count || 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const descriptions = Object.entries(windowsByWall).map(([wall, count]) => {
    return count === 1
      ? `One window on the ${wall} wall`
      : `${count} windows on the ${wall} wall`;
  });

  return descriptions.join('. ') + ' providing natural light';
}

/**
 * Build door description from door data
 */
function buildDoorDescription(doors: DoorInfo[]): string {
  if (!doors || doors.length === 0) {
    return 'No visible doors';
  }

  const descriptions = doors.map((d) => {
    const wall = d.wall || 'unknown';
    const leadsTo = d.leads_to ? ` leading to ${d.leads_to}` : '';
    return `Door on ${wall} wall${leadsTo}`;
  });

  return descriptions.join('. ');
}

/**
 * Build a structured prompt including full room geometry
 */
export function buildStructuredImagePrompt(
  room: Room,
  userRequest: string,
  viewType: ViewType = 'main',
  project?: Project
): string {
  // Parse room data
  let geometry: RoomGeometry = {};
  let windows: WindowInfo[] = [];
  let doors: DoorInfo[] = [];
  let fixtures: string[] = [];
  let adjacentRooms: string[] = [];

  try {
    geometry = JSON.parse(room.geometry || '{}');
  } catch {
    geometry = {};
  }
  try {
    windows = JSON.parse(room.windows || '[]');
  } catch {
    windows = [];
  }
  try {
    doors = JSON.parse(room.doors || '[]');
  } catch {
    doors = [];
  }
  try {
    fixtures = JSON.parse(room.fixtures || '[]');
  } catch {
    fixtures = [];
  }
  try {
    adjacentRooms = JSON.parse(room.adjacent_rooms || '[]');
  } catch {
    adjacentRooms = [];
  }

  // Build dimension string (support both naming conventions)
  const geometryAny = geometry as Record<string, number | undefined>;
  const length = geometry.length_m || geometryAny['width'] || 5;
  const width = geometry.width_m || geometryAny['height'] || 4;
  const area = geometry.area_sqm || (length * width).toFixed(1);
  const dimensionStr = `${length}m x ${width}m (${area} sqm)`;

  // Get project style info
  const style = project?.architecture_style || 'modern';
  const atmosphere = project?.atmosphere || '';

  // Get color palette
  let colorPaletteStr = 'neutral tones';
  if (project) {
    const colors = getColorPaletteByProjectId(project.id);
    if (colors.length > 0) {
      colorPaletteStr = colors.map((c) => c.name).join(', ');
    }
  }

  // Build the structured prompt
  const parts = [
    `${style} interior photograph of a ${room.type.toLowerCase()}, ${dimensionStr}`,
    buildWindowDescription(windows),
    buildDoorDescription(doors),
    `Color palette: ${colorPaletteStr}`,
  ];

  // Add atmosphere if available
  if (atmosphere) {
    parts.push(`Atmosphere: ${atmosphere}`);
  }

  // Add fixtures if any
  if (fixtures.length > 0) {
    parts.push(`Fixed elements: ${fixtures.join(', ')}`);
  }

  // Add adjacent rooms context
  if (adjacentRooms.length > 0) {
    parts.push(`Adjacent to: ${adjacentRooms.join(', ')}`);
  }

  // Add user request
  parts.push(userRequest);

  // Add camera angle based on view type
  parts.push(VIEW_TYPE_CAMERA_ANGLES[viewType]);

  // Combine and enhance with quality modifiers
  const basePrompt = parts.filter(Boolean).join('. ');
  return enhancePrompt(basePrompt);
}

export interface RoomImageContext {
  hasImage: boolean;
  imageUrl?: string;
  prompt?: string;
  detectedObjects?: string[];
}

export function getSystemPrompt(
  project: Project,
  currentRoom: Room | null,
  imageContext?: RoomImageContext
): string {
  const preferences = project.global_preferences
    ? JSON.parse(project.global_preferences)
    : {};

  let prompt = `You are an expert interior designer AI assistant helping design the "${project.name}" project.

${currentRoom ? `You are currently working on the "${currentRoom.name}" (${currentRoom.type}).` : 'No room is currently selected.'}`;

  // Add current image context if available
  if (imageContext?.hasImage && currentRoom) {
    prompt += `\n\n## Current Room Image
This room ALREADY HAS a generated design image. You can see it in the viewer.
- The image shows the current design for this ${currentRoom.type}
${imageContext.prompt ? `- Original prompt: "${imageContext.prompt}"` : ''}
${imageContext.detectedObjects && imageContext.detectedObjects.length > 0 
  ? `- Detected furniture/objects: ${imageContext.detectedObjects.join(', ')}`
  : '- Objects in image: table, chairs, cabinets, lighting fixtures, and other typical room elements'}

IMPORTANT: You do NOT need the user to upload or share an image - the image is already available.
When the user asks to change something (like "change the table color to white"), proceed directly with the edit.
Do NOT ask for the image - it's already there. Just confirm what change you're making and do it.`;
  }

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
2. Scan images to detect furniture and fixtures
3. Help approve rooms when the design is finalized
4. Provide room context and information
${!currentRoom ? '5. Update project preferences during onboarding' : ''}

For precise image edits (like changing specific furniture or colors), users can use the canvas editor by clicking the "Edit" button on an image. This allows them to draw a mask on the area they want to change and describe what should appear there.

Guidelines:
- Be conversational and helpful
- Ask clarifying questions about design preferences
- Suggest design ideas that match the user's style
- When generating images, create detailed prompts for photorealistic interior design renders
- Guide users through the room-by-room design process
- For targeted edits, suggest using the canvas editor for best results

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
  // Extract wizard preferences
  const buildingType = preferences.buildingType || preferences.building_type || '';
  const architectureStyle = preferences.architectureStyle || preferences.architecture_style || preferences.style || 'modern';
  const atmosphere = preferences.atmosphere || 'bright and airy';
  const constraints = preferences.constraints || [];
  const customNotes = preferences.customNotes || preferences.custom_notes || '';
  
  // Parse room geometry and features
  let geometry: any = {};
  let doors: any[] = [];
  let windows: any[] = [];
  let fixtures: any[] = [];
  let adjacentRooms: any[] = [];
  
  try {
    geometry = room.geometry ? JSON.parse(room.geometry) : {};
    doors = room.doors ? JSON.parse(room.doors) : [];
    windows = room.windows ? JSON.parse(room.windows) : [];
    fixtures = room.fixtures ? JSON.parse(room.fixtures) : [];
    adjacentRooms = room.adjacent_rooms ? JSON.parse(room.adjacent_rooms) : [];
  } catch (e) {
    // Fallback to empty if parsing fails
  }

  // Build comprehensive prompt parts
  const parts: string[] = [];
  
  // 1. Base description with style and atmosphere
  parts.push(`Photorealistic interior design render of a ${room.type.toLowerCase()}`);
  if (buildingType) {
    parts.push(`in a ${buildingType}`);
  }
  parts.push(`with ${architectureStyle} architectural style`);
  parts.push(`creating a ${atmosphere} atmosphere`);
  
  // 2. User description
  if (userDescription && userDescription.trim()) {
    parts.push(`. ${userDescription}`);
  }
  
  // 3. Room dimensions (if available)
  if (geometry.length_ft && geometry.width_ft) {
    parts.push(`. Spacious ${geometry.length_ft} by ${geometry.width_ft} feet room`);
  } else if (geometry.area_sqft) {
    parts.push(`. ${geometry.area_sqft} square feet of space`);
  }
  
  // 4. Natural lighting from windows
  if (windows.length > 0) {
    const windowCount = windows.length;
    const windowPositions = windows.map((w: any) => w.position || w.location).filter(Boolean);
    if (windowPositions.length > 0) {
      parts.push(`. Natural light streaming through ${windowCount} ${windowCount === 1 ? 'window' : 'windows'} on the ${windowPositions.join(' and ')} side${windowCount > 1 ? 's' : ''}`);
    } else {
      parts.push(`. Abundant natural light from ${windowCount} large ${windowCount === 1 ? 'window' : 'windows'}`);
    }
  } else {
    parts.push(`. Well-lit with natural and ambient lighting`);
  }
  
  // 5. Doors and flow
  if (doors.length > 0 && adjacentRooms.length > 0) {
    parts.push(`. Seamless flow connecting to ${adjacentRooms.slice(0, 2).join(' and ')}`);
  }
  
  // 6. Fixed fixtures
  if (fixtures.length > 0) {
    const fixtureList = fixtures.slice(0, 3).join(', ');
    parts.push(`. Features ${fixtureList}`);
  }
  
  // 7. Constraints and special requirements
  const constraintDetails: string[] = [];
  if (Array.isArray(constraints)) {
    const constraintStrings = constraints.map((c: any) => String(c).toLowerCase());
    if (constraintStrings.some(c => c.includes('kid-friendly') || c.includes('kid friendly'))) {
      constraintDetails.push('child-safe furniture with rounded edges');
    }
    if (constraintStrings.some(c => c.includes('pet-friendly') || c.includes('pet friendly'))) {
      constraintDetails.push('durable, easy-to-clean materials');
    }
    if (constraintStrings.some(c => c.includes('storage'))) {
      constraintDetails.push('built-in storage solutions and organizational features');
    }
    if (constraintStrings.some(c => c.includes('sustainable') || c.includes('eco-friendly'))) {
      constraintDetails.push('eco-friendly and sustainable materials');
    }
    if (constraintStrings.some(c => c.includes('luxury') || c.includes('premium'))) {
      constraintDetails.push('premium finishes and high-end materials');
    }
  }
  
  if (constraintDetails.length > 0) {
    parts.push(`. Incorporating ${constraintDetails.join(', ')}`);
  }
  
  // 8. Custom notes
  if (customNotes && customNotes.trim()) {
    parts.push(`. ${customNotes}`);
  }
  
  // 9. Color palette
  const colors = preferences.colors || preferences.colorMood || 'neutral tones with warm accents';
  parts.push(`. Color palette: ${colors}`);
  
  // 10. Professional quality descriptors
  parts.push(`. Professional interior photography, high-end finishes, detailed textures on furniture and fabrics, sophisticated material choices, 8K resolution, architectural visualization quality, photorealistic rendering`);
  
  return parts.join('');
}
