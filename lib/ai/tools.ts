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
} from '@/lib/db/queries';
import { buildImagePrompt, getRoomContextPrompt } from './prompts';
import { logger } from '@/lib/logger';

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
        logger.info('ai.tools', 'generate_room_image called', {
          roomId: targetRoomId,
          viewType,
          descLength: description.length,
        });

        if (!targetRoomId) {
          logger.warn('ai.tools', 'generate_room_image: no room selected');
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          logger.warn('ai.tools', 'generate_room_image: room not found', { roomId: targetRoomId });
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

          logger.debug('ai.tools', 'Image generation job started', { jobId: job.id, roomId: targetRoomId });

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

            logger.info('ai.tools', 'Image generated successfully', {
              imageId: image?.id,
              roomId: targetRoomId,
              viewType,
            });

            return {
              success: true,
              imageUrl: result.imageUrl,
              imageId: image?.id,
              message: `Generated a ${viewType || 'perspective'} view of the ${room.name}`,
            };
          }

          logger.error('ai.tools', 'Image generation failed', { error: result.error, roomId: targetRoomId });
          return { success: false, error: result.error || 'Generation failed' };
        } catch (error) {
          logger.error('ai.tools', 'Exception during image generation', { error, roomId: targetRoomId });
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
        logger.info('ai.tools', 'edit_room_image called', { imageId, roomId: currentRoomId });

        const images = currentRoomId
          ? getRoomImagesByRoomId(currentRoomId)
          : [];
        const targetImage = images.find((img) => img.id === imageId);

        if (!targetImage) {
          logger.warn('ai.tools', 'edit_room_image: image not found', { imageId });
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

          logger.debug('ai.tools', 'Image edit job started', { jobId: job.id, imageId });

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

            logger.info('ai.tools', 'Image edited successfully', {
              newImageId: newImage?.id,
              originalImageId: imageId,
              roomId: currentRoomId,
            });

            return {
              success: true,
              imageUrl: result.imageUrl,
              imageId: newImage?.id,
              message: `Edited the ${room?.name || 'room'} image: ${editDescription}`,
            };
          }

          logger.error('ai.tools', 'Image edit failed', { error: result.error, imageId });
          return { success: false, error: result.error || 'Edit failed' };
        } catch (error) {
          logger.error('ai.tools', 'Exception during image edit', { error, imageId });
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
        logger.info('ai.tools', 'scan_image_items called', { imageId, roomId: currentRoomId });

        const images = currentRoomId
          ? getRoomImagesByRoomId(currentRoomId)
          : [];
        const targetImage = images.find((img) => img.id === imageId);

        if (!targetImage) {
          logger.warn('ai.tools', 'scan_image_items: image not found', { imageId });
          return { success: false, error: 'Image not found' };
        }

        // In a real implementation, this would use vision AI to detect items
        // For now, return a mock list based on room type
        const room = getRoomById(targetImage.room_id);
        const mockItems = getMockItemsForRoomType(room?.type || 'Living Room');

        // Update image with detected items
        updateRoomImageItems(imageId, JSON.stringify(mockItems));

        logger.info('ai.tools', 'Items scanned successfully', { imageId, itemCount: mockItems.length });

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
        logger.info('ai.tools', 'approve_room called', { roomId: targetRoomId });

        if (!targetRoomId) {
          logger.warn('ai.tools', 'approve_room: no room selected');
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          logger.warn('ai.tools', 'approve_room: room not found', { roomId: targetRoomId });
          return { success: false, error: 'Room not found' };
        }

        // Check if room has at least one image
        const images = getRoomImagesByRoomId(targetRoomId);
        if (images.length === 0) {
          logger.warn('ai.tools', 'approve_room: room has no images', { roomId: targetRoomId });
          return {
            success: false,
            error: 'Room must have at least one design image before approval',
          };
        }

        approveRoomDb(targetRoomId);

        logger.info('ai.tools', 'Room approved successfully', { roomId: targetRoomId, roomName: room.name });

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
        logger.info('ai.tools', 'get_room_context called', { roomId: targetRoomId });

        if (!targetRoomId) {
          logger.warn('ai.tools', 'get_room_context: no room selected');
          return { success: false, error: 'No room selected' };
        }

        const room = getRoomById(targetRoomId);
        if (!room) {
          logger.warn('ai.tools', 'get_room_context: room not found', { roomId: targetRoomId });
          return { success: false, error: 'Room not found' };
        }

        const images = getRoomImagesByRoomId(targetRoomId);
        const context = getRoomContextPrompt(room);

        logger.debug('ai.tools', 'Room context retrieved', {
          roomId: targetRoomId,
          imageCount: images.length,
        });

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
