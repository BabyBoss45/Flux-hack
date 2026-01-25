import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { generateImage, editImage } from '@/lib/bfl/client';
import { pollForResult } from '@/lib/bfl/polling';
import {
  getRoomById,
  getProjectById,
  createRoomImage,
  approveRoom as approveRoomDb,
  getRoomImagesByRoomId,
  updateRoomImageItems,
  updateProjectPreferences,
  addColorsToPalette,
  type Room,
} from '@/lib/db/queries';
import {
  getRoomContextPrompt,
  buildStructuredImagePrompt,
  calculateAspectRatio,
  sanitizePrompt,
  type ViewType,
  type RoomGeometry,
} from './prompts';

// ============================================================================
// Types
// ============================================================================

export interface DetectedItem {
  id: string;
  name: string;
  category: 'furniture' | 'fixture' | 'decor' | 'architectural';
  position_hint?: string;
}

export type EditType = 'replace' | 'modify' | 'remove' | 'add';

export interface AmbiguityError {
  type: 'AMBIGUOUS_TARGET';
  message: string;
  matching_items: string[];
  suggestion: string;
}

export interface ConstraintError {
  type: 'CONSTRAINT_VIOLATION';
  message: string;
  constraint: string;
  suggestion: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer the edit type from the instruction text
 */
export function inferEditType(instruction: string): EditType {
  const lower = instruction.toLowerCase();

  if (lower.includes('remove') || lower.includes('delete')) {
    return 'remove';
  }
  if (lower.includes('add') || lower.includes('place') || lower.includes('put')) {
    return 'add';
  }
  if (
    lower.includes('change to') ||
    lower.includes('replace with') ||
    lower.includes('swap')
  ) {
    return 'replace';
  }
  // Default: modify attributes (color, size, style)
  return 'modify';
}

/**
 * Extract position/wall from an instruction
 */
function extractPosition(instruction: string): string | null {
  const lower = instruction.toLowerCase();
  const wallMatch = lower.match(
    /\b(on the |on |at the |at )?(north|south|east|west|left|right|back|front)\s*(wall)?\b/
  );
  return wallMatch ? wallMatch[2] : null;
}

/**
 * Check if a wall is interior based on adjacent rooms
 */
function isInteriorWall(wall: string, adjacentRooms: string[]): boolean {
  // If there are adjacent rooms, assume walls facing them are interior
  // This is a simplified check - in a real implementation, you'd have
  // wall-to-room mappings
  return adjacentRooms.length > 0 && ['north', 'south', 'east', 'west'].includes(wall);
}

/**
 * Check if an item is an architectural element
 */
function isArchitecturalElement(item: string): boolean {
  const architecturalItems = ['window', 'door', 'wall', 'ceiling', 'floor', 'column', 'beam'];
  const lower = item.toLowerCase();
  return architecturalItems.some((a) => lower.includes(a));
}

/**
 * Validate edit constraints against room geometry
 */
export function validateEditConstraints(
  targetItem: string,
  instruction: string,
  room: Room
): { valid: true } | { valid: false; error: ConstraintError } {
  const editType = inferEditType(instruction);

  // Parse adjacent rooms
  let adjacentRooms: string[] = [];
  try {
    adjacentRooms = JSON.parse(room.adjacent_rooms || '[]');
  } catch {
    adjacentRooms = [];
  }

  // Example: Block adding windows to interior walls
  if (editType === 'add' && targetItem.toLowerCase().includes('window')) {
    const position = extractPosition(instruction);
    if (position && isInteriorWall(position, adjacentRooms)) {
      return {
        valid: false,
        error: {
          type: 'CONSTRAINT_VIOLATION',
          message: `Cannot add window on ${position} wall`,
          constraint: `${position} wall is interior (adjacent to ${adjacentRooms.join(', ')})`,
          suggestion: 'Windows can be added to exterior walls only',
        },
      };
    }
  }

  // Block removing structural elements
  if (editType === 'remove' && isArchitecturalElement(targetItem)) {
    const structuralItems = ['wall', 'ceiling', 'floor', 'column', 'beam'];
    if (structuralItems.some((s) => targetItem.toLowerCase().includes(s))) {
      return {
        valid: false,
        error: {
          type: 'CONSTRAINT_VIOLATION',
          message: `Cannot remove structural element: ${targetItem}`,
          constraint: 'Structural elements cannot be removed',
          suggestion: 'Consider modifying the appearance instead of removing',
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Check for ambiguity when targeting items
 */
export function checkAmbiguity(
  targetItem: string,
  detectedItems: DetectedItem[]
): AmbiguityError | null {
  const lower = targetItem.toLowerCase();

  // Find all items that match the target
  const matches = detectedItems.filter((item) => {
    const itemLower = item.name.toLowerCase();
    return itemLower.includes(lower) || lower.includes(itemLower);
  });

  // If more than one match and no position hint in target, it's ambiguous
  if (matches.length > 1) {
    const hasPositionHint = /\b(near|by|next to|left|right|corner|center|window|door)\b/i.test(
      targetItem
    );
    if (!hasPositionHint) {
      const matchNames = matches.map((m) => {
        return m.position_hint ? `${m.name} (${m.position_hint})` : m.name;
      });
      return {
        type: 'AMBIGUOUS_TARGET',
        message: `Multiple items match "${targetItem}"`,
        matching_items: matchNames,
        suggestion: `Please specify: ${matchNames.map((n) => `'the ${n}'`).join(' or ')}`,
      };
    }
  }

  return null;
}

/**
 * Scan image for items (mock implementation - can be enhanced with vision AI)
 */
export async function scanImageItems(
  _imageUrl: string,
  roomType: string
): Promise<DetectedItem[]> {
  // In a real implementation, this would use vision AI to detect items
  // For now, return mock items based on room type with proper structure
  const mockItemsByType: Record<string, Array<{ name: string; category: DetectedItem['category']; position_hint?: string }>> = {
    'Living Room': [
      { name: 'Sofa', category: 'furniture', position_hint: 'center of room' },
      { name: 'Coffee Table', category: 'furniture', position_hint: 'in front of sofa' },
      { name: 'Armchair', category: 'furniture', position_hint: 'near window' },
      { name: 'Floor Lamp', category: 'decor', position_hint: 'corner' },
      { name: 'Area Rug', category: 'decor', position_hint: 'under coffee table' },
      { name: 'TV Console', category: 'furniture', position_hint: 'opposite sofa' },
    ],
    Bedroom: [
      { name: 'Bed', category: 'furniture', position_hint: 'center of room' },
      { name: 'Nightstand', category: 'furniture', position_hint: 'beside bed' },
      { name: 'Dresser', category: 'furniture', position_hint: 'against wall' },
      { name: 'Table Lamp', category: 'decor', position_hint: 'on nightstand' },
      { name: 'Wardrobe', category: 'furniture', position_hint: 'corner' },
      { name: 'Area Rug', category: 'decor', position_hint: 'beside bed' },
    ],
    Kitchen: [
      { name: 'Kitchen Island', category: 'fixture', position_hint: 'center of room' },
      { name: 'Bar Stools', category: 'furniture', position_hint: 'at island' },
      { name: 'Pendant Lights', category: 'fixture', position_hint: 'above island' },
      { name: 'Refrigerator', category: 'fixture', position_hint: 'against wall' },
      { name: 'Range', category: 'fixture', position_hint: 'against wall' },
      { name: 'Cabinets', category: 'architectural', position_hint: 'upper walls' },
    ],
    Bathroom: [
      { name: 'Vanity', category: 'fixture', position_hint: 'against wall' },
      { name: 'Mirror', category: 'fixture', position_hint: 'above vanity' },
      { name: 'Toilet', category: 'fixture', position_hint: 'against wall' },
      { name: 'Shower', category: 'fixture', position_hint: 'corner' },
      { name: 'Bathtub', category: 'fixture', position_hint: 'against wall' },
      { name: 'Towel Rack', category: 'decor', position_hint: 'near shower' },
    ],
    Dining: [
      { name: 'Dining Table', category: 'furniture', position_hint: 'center of room' },
      { name: 'Dining Chairs', category: 'furniture', position_hint: 'around table' },
      { name: 'Chandelier', category: 'fixture', position_hint: 'above table' },
      { name: 'Sideboard', category: 'furniture', position_hint: 'against wall' },
      { name: 'Area Rug', category: 'decor', position_hint: 'under table' },
    ],
    Office: [
      { name: 'Desk', category: 'furniture', position_hint: 'near window' },
      { name: 'Office Chair', category: 'furniture', position_hint: 'at desk' },
      { name: 'Bookshelf', category: 'furniture', position_hint: 'against wall' },
      { name: 'Desk Lamp', category: 'decor', position_hint: 'on desk' },
      { name: 'Filing Cabinet', category: 'furniture', position_hint: 'beside desk' },
    ],
  };

  const items = mockItemsByType[roomType] || [
    { name: 'Furniture', category: 'furniture' as const },
    { name: 'Lighting', category: 'fixture' as const },
    { name: 'Decor', category: 'decor' as const },
  ];

  // Generate unique IDs for each item
  return items.map((item, index) => ({
    id: `item_${index + 1}`,
    name: item.name,
    category: item.category,
    position_hint: item.position_hint,
  }));
}

/**
 * Generate image with retry and sanitization on error
 */
async function generateWithRetry(
  prompt: string,
  width: number,
  height: number,
  maxRetries = 1
): Promise<{ id: string; imageUrl: string; promptUsed: string }> {
  try {
    const job = await generateImage({ prompt, width, height });
    const result = await pollForResult(job.id);

    if (result.success && result.imageUrl) {
      return { id: job.id, imageUrl: result.imageUrl, promptUsed: prompt };
    }
    throw new Error(result.error || 'Generation failed');
  } catch (error) {
    if (maxRetries > 0 && error instanceof Error) {
      // Check if it's a prompt-related error
      const isPromptError =
        error.message.includes('moderat') ||
        error.message.includes('content') ||
        error.message.includes('prompt');

      if (isPromptError) {
        const sanitized = sanitizePrompt(prompt);
        return generateWithRetry(sanitized, width, height, maxRetries - 1);
      }
    }
    throw error;
  }
}

export function createAiTools(
  _projectId: number,
  currentRoomId: number | null,
  preferences: Record<string, string>
) {
  return {
    generate_room_image: tool({
      description:
        'Generate a photorealistic interior design image for a room. Builds a structured prompt including room geometry, windows, doors, and user request.',
      inputSchema: zodSchema(
        z.object({
          room_id: z
            .number()
            .optional()
            .describe('Room ID to generate image for (defaults to current room)'),
          user_request: z
            .string()
            .describe("User's conversational request describing the desired design"),
          view_type: z
            .enum(['main', 'alternate_angle', 'variation'])
            .optional()
            .describe('Type of view: main (entrance view), alternate_angle (corner view), or variation (style variation)'),
        })
      ),
      execute: async ({ room_id, user_request, view_type }) => {
        const targetRoomId = room_id || currentRoomId;
        if (!targetRoomId) {
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          return { success: false, error: 'Room not found' };
        }

        // Get project for style information
        const project = getProjectById(room.project_id);

        // Parse room geometry for aspect ratio calculation
        let geometry: RoomGeometry = {};
        try {
          geometry = JSON.parse(room.geometry || '{}');
        } catch {
          geometry = {};
        }

        // Calculate room-adaptive resolution
        const { width, height } = calculateAspectRatio(geometry);

        // Build structured prompt with full room data
        const resolvedViewType: ViewType = view_type || 'main';
        const prompt = buildStructuredImagePrompt(room, user_request, resolvedViewType, project);

        try {
          // Generate with retry on prompt errors
          const result = await generateWithRetry(prompt, width, height);

          // Auto-scan for items after generation
          const detectedItems = await scanImageItems(result.imageUrl, room.type);

          // Save to database with detected items
          const image = createRoomImage(
            targetRoomId,
            result.imageUrl,
            user_request,
            resolvedViewType,
            JSON.stringify(detectedItems)
          );

          return {
            success: true,
            image_id: image?.id,
            image_url: result.imageUrl,
            prompt_used: result.promptUsed,
            view_type: resolvedViewType,
            detected_items: detectedItems,
            message: `Generated a ${resolvedViewType} view of the ${room.name}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Generation failed',
          };
        }
      },
    }),

    edit_room_image: tool({
      description:
        'Edit an existing room image to modify specific elements. Includes edit type inference, ambiguity detection, and constraint validation.',
      inputSchema: zodSchema(
        z.object({
          image_url: z
            .string()
            .describe('Source image URL to edit'),
          room_id: z
            .number()
            .optional()
            .describe('Room ID for constraint validation (defaults to current room)'),
          target_item: z
            .string()
            .describe("Item to modify (e.g., 'sofa', 'lamp near window')"),
          edit_instruction: z
            .string()
            .describe("What to do (e.g., 'change to blue velvet', 'remove')"),
        })
      ),
      execute: async ({ image_url, room_id, target_item, edit_instruction }) => {
        const targetRoomId = room_id || currentRoomId;
        if (!targetRoomId) {
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          return { success: false, error: 'Room not found' };
        }

        // Infer edit type from instruction
        const editType = inferEditType(edit_instruction);

        // Validate constraints before proceeding
        const constraintCheck = validateEditConstraints(target_item, edit_instruction, room);
        if (!constraintCheck.valid) {
          return {
            success: false,
            error: constraintCheck.error,
          };
        }

        // Get existing detected items from the most recent image
        const images = getRoomImagesByRoomId(targetRoomId);
        const sourceImage = images.find((img) => img.url === image_url);
        let existingItems: DetectedItem[] = [];

        if (sourceImage) {
          try {
            const parsed = JSON.parse(sourceImage.detected_items || '[]');
            existingItems = Array.isArray(parsed) ? parsed : [];
          } catch {
            existingItems = [];
          }
        }

        // Check for ambiguity if we have detected items
        if (existingItems.length > 0) {
          const ambiguity = checkAmbiguity(target_item, existingItems);
          if (ambiguity) {
            return {
              success: false,
              error: ambiguity,
            };
          }
        }

        try {
          // Fetch the original image and convert to base64
          const imageResponse = await fetch(image_url);
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');

          // Build edit prompt combining target and instruction
          const editPrompt = `${editType} the ${target_item}: ${edit_instruction}`;

          // Start edit job
          const job = await editImage({
            image: base64Image,
            prompt: editPrompt,
          });

          // Poll for result
          const result = await pollForResult(job.id);

          if (result.success && result.imageUrl) {
            // Full re-scan of items after edit
            const detectedItems = await scanImageItems(result.imageUrl, room.type);

            // Save new image version (preserves original)
            const newImage = createRoomImage(
              targetRoomId,
              result.imageUrl,
              `Edit: ${target_item} - ${edit_instruction}`,
              'variation',
              JSON.stringify(detectedItems)
            );

            return {
              success: true,
              image_id: newImage?.id,
              image_url: result.imageUrl,
              edit_type: editType,
              edit_applied: `${editType} ${target_item}: ${edit_instruction}`,
              detected_items: detectedItems,
              message: `Edited the ${room.name}: ${editType} ${target_item}`,
            };
          }

          return { success: false, error: result.error || 'Edit failed' };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Edit failed',
          };
        }
      },
    }),

    scan_image_items: tool({
      description:
        'Analyze a room image to detect and list furniture, fixtures, and decor with position hints',
      inputSchema: zodSchema(
        z.object({
          imageId: z.number().describe('ID of the image to scan'),
        })
      ),
      execute: async ({ imageId }) => {
        const images = currentRoomId
          ? getRoomImagesByRoomId(currentRoomId)
          : [];
        const targetImage = images.find((img) => img.id === imageId);

        if (!targetImage) {
          return { success: false, error: 'Image not found' };
        }

        // Scan image for items (mock for now, can integrate vision AI later)
        const room = getRoomById(targetImage.room_id);
        const detectedItems = await scanImageItems(
          targetImage.url,
          room?.type || 'Living Room'
        );

        // Update image with detected items
        updateRoomImageItems(imageId, JSON.stringify(detectedItems));

        return {
          success: true,
          items: detectedItems,
          message: `Found ${detectedItems.length} items in the image`,
        };
      },
    }),

    approve_room: tool({
      description:
        'Mark a room design as approved and complete. Use when the user is satisfied with the design.',
      inputSchema: zodSchema(
        z.object({
          roomId: z
            .number()
            .optional()
            .describe('Room ID to approve (defaults to current room)'),
        })
      ),
      execute: async ({ roomId }) => {
        const targetRoomId = roomId || currentRoomId;
        if (!targetRoomId) {
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          return { success: false, error: 'Room not found' };
        }

        // Check if room has at least one image
        const images = getRoomImagesByRoomId(targetRoomId);
        if (images.length === 0) {
          return {
            success: false,
            error: 'Room must have at least one design image before approval',
          };
        }

        approveRoomDb(targetRoomId);

        return {
          success: true,
          message: `"${room.name}" has been approved! You can now move on to the next room.`,
        };
      },
    }),

    get_room_context: tool({
      description:
        'Get detailed information about a specific room or the current room',
      inputSchema: zodSchema(
        z.object({
          roomId: z
            .number()
            .optional()
            .describe('Room ID to get context for (defaults to current room)'),
        })
      ),
      execute: async ({ roomId }) => {
        const targetRoomId = roomId || currentRoomId;
        if (!targetRoomId) {
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          return { success: false, error: 'Room not found' };
        }

        const images = getRoomImagesByRoomId(targetRoomId);
        const context = getRoomContextPrompt(room);

        return {
          success: true,
          room: {
            id: room.id,
            name: room.name,
            type: room.type,
            approved: room.approved === 1,
          },
          context,
          imageCount: images.length,
          latestImageUrl: images[0]?.url,
        };
      },
    }),

    update_project_preferences: tool({
      description:
        'Update project design preferences based on user input during onboarding',
      inputSchema: zodSchema(
        z.object({
          building_type: z
            .string()
            .optional()
            .describe(
              'Type of building (e.g., residential apartment, commercial office)'
            ),
          architecture_style: z
            .string()
            .optional()
            .describe(
              'Design style (e.g., modern minimalist, mid-century modern)'
            ),
          atmosphere: z
            .string()
            .optional()
            .describe('Desired mood/feel (e.g., cozy and warm, bright and airy)'),
          colors: z
            .array(
              z.object({
                hex: z.string().describe('Hex color code (e.g., #3498db)'),
                name: z
                  .string()
                  .describe('Human-readable color name (e.g., Ocean Blue)'),
              })
            )
            .optional()
            .describe('Color palette for the project'),
        })
      ),
      execute: async ({ building_type, architecture_style, atmosphere, colors }) => {
        try {
          // Update text preferences
          if (building_type || architecture_style || atmosphere) {
            updateProjectPreferences(_projectId, {
              building_type,
              architecture_style,
              atmosphere,
            });
          }

          // Add colors to palette
          if (colors && colors.length > 0) {
            const colorsWithOrder = colors.map((color, index) => ({
              ...color,
              sort_order: index,
            }));
            addColorsToPalette(_projectId, colorsWithOrder);
          }

          // Build acknowledgment message
          const updated: string[] = [];
          if (building_type) updated.push(`building type: ${building_type}`);
          if (architecture_style) updated.push(`style: ${architecture_style}`);
          if (atmosphere) updated.push(`atmosphere: ${atmosphere}`);
          if (colors) updated.push(`${colors.length} colors`);

          return {
            success: true,
            message: `Updated project preferences: ${updated.join(', ')}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update preferences',
          };
        }
      },
    }),
  };
}
