import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { generateImage, editImage } from '@/lib/bfl/client';
import { pollForResult } from '@/lib/bfl/polling';
import {
  getRoomById,
  createRoomImage,
  approveRoom as approveRoomDb,
  getRoomImagesByRoomId,
  updateRoomImageItems,
  updateProjectPreferences,
  addColorsToPalette,
} from '@/lib/db/queries';
import { buildImagePrompt, getRoomContextPrompt } from './prompts';

export function createAiTools(
  _projectId: number,
  currentRoomId: number | null,
  preferences: Record<string, string>
) {
  return {
    generate_room_image: tool({
      description:
        'Generate a photorealistic interior design image for the current room based on a description',
      inputSchema: zodSchema(
        z.object({
          description: z
            .string()
            .describe('Description of the room design to generate'),
          roomId: z
            .number()
            .optional()
            .describe('Room ID to generate image for (defaults to current room)'),
          viewType: z
            .enum(['perspective', 'wide', 'detail', 'overhead'])
            .optional()
            .describe('Type of view angle for the image'),
        })
      ),
      execute: async ({ description, roomId, viewType }) => {
        const targetRoomId = roomId || currentRoomId;
        if (!targetRoomId) {
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          return { success: false, error: 'Room not found' };
        }

        // Build enhanced prompt
        const prompt = buildImagePrompt(description, room, preferences);

        try {
          // Start generation
          const job = await generateImage({
            prompt,
            width: 1024,
            height: 768,
          });

          // Poll for result
          const result = await pollForResult(job.id);

          if (result.success && result.imageUrl) {
            // Save to database
            const image = createRoomImage(
              targetRoomId,
              result.imageUrl,
              description,
              viewType || 'perspective'
            );

            return {
              success: true,
              imageUrl: result.imageUrl,
              imageId: image?.id,
              message: `Generated a ${viewType || 'perspective'} view of the ${room.name}`,
            };
          }

          return { success: false, error: result.error || 'Generation failed' };
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
        'Edit an existing room image to modify specific elements or furniture',
      inputSchema: zodSchema(
        z.object({
          imageId: z.number().describe('ID of the image to edit'),
          editDescription: z
            .string()
            .describe('Description of what to change in the image'),
          mask: z
            .string()
            .optional()
            .describe('Base64 encoded mask for targeted editing'),
        })
      ),
      execute: async ({ imageId, editDescription }) => {
        const images = currentRoomId
          ? getRoomImagesByRoomId(currentRoomId)
          : [];
        const targetImage = images.find((img) => img.id === imageId);

        if (!targetImage) {
          return { success: false, error: 'Image not found' };
        }

        try {
          // Fetch the original image and convert to base64
          const imageResponse = await fetch(targetImage.url);
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');

          // Start edit job
          const job = await editImage({
            image: base64Image,
            prompt: editDescription,
          });

          // Poll for result
          const result = await pollForResult(job.id);

          if (result.success && result.imageUrl) {
            // Save new image version
            const room = currentRoomId ? getRoomById(currentRoomId) : null;
            const newImage = createRoomImage(
              targetImage.room_id,
              result.imageUrl,
              `Edit: ${editDescription}`,
              targetImage.view_type
            );

            return {
              success: true,
              imageUrl: result.imageUrl,
              imageId: newImage?.id,
              message: `Edited the ${room?.name || 'room'} image: ${editDescription}`,
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
        'Analyze a room image to detect and list furniture and fixtures',
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

        // In a real implementation, this would use vision AI to detect items
        // For now, return a mock list based on room type
        const room = getRoomById(targetImage.room_id);
        const mockItems = getMockItemsForRoomType(room?.type || 'Living Room');

        // Update image with detected items
        updateRoomImageItems(imageId, JSON.stringify(mockItems));

        return {
          success: true,
          items: mockItems,
          message: `Found ${mockItems.length} items in the image`,
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

function getMockItemsForRoomType(roomType: string): string[] {
  const itemsByType: Record<string, string[]> = {
    'Living Room': [
      'Sofa',
      'Coffee Table',
      'Armchair',
      'Floor Lamp',
      'Area Rug',
      'TV Console',
    ],
    Bedroom: [
      'Bed',
      'Nightstand',
      'Dresser',
      'Table Lamp',
      'Wardrobe',
      'Area Rug',
    ],
    Kitchen: [
      'Kitchen Island',
      'Bar Stools',
      'Pendant Lights',
      'Refrigerator',
      'Range',
      'Cabinets',
    ],
    Bathroom: [
      'Vanity',
      'Mirror',
      'Toilet',
      'Shower',
      'Bathtub',
      'Towel Rack',
    ],
    Dining: [
      'Dining Table',
      'Dining Chairs',
      'Chandelier',
      'Sideboard',
      'Area Rug',
    ],
    Office: ['Desk', 'Office Chair', 'Bookshelf', 'Desk Lamp', 'Filing Cabinet'],
  };

  return itemsByType[roomType] || ['Furniture', 'Lighting', 'Decor'];
}
