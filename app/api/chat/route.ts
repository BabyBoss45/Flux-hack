import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, getRoomById, createMessage, getRoomImagesByRoomId, getRoomImageById, createRoomImage, updateRoomImageItems, getRoomsByProjectId } from '@/lib/db/queries';
import { createAiTools } from '@/lib/ai/tools';
import { getSystemPrompt } from '@/lib/ai/prompts';
import { parseUserIntent } from '@/lib/klein/parser';
import { buildKleinTasks } from '@/lib/klein/task-builder';
import { executeKleinTasks } from '@/lib/klein/runware-client';
import { detectObjects } from '@/lib/klein/object-detection';
import type { RoomImage, DetectedObject } from '@/lib/klein/types';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    console.log('=== Chat API Request ===');
    console.log('Raw body keys:', Object.keys(body));

    const { messages, projectId, roomKey, selectedObjectId, currentImageId } = body;

    console.log('🔥🔥🔥 CHAT API REQUEST RECEIVED 🔥🔥🔥');
    console.log('🔥 Project ID:', projectId);
    console.log('🔥 Room Key:', roomKey);
    console.log('🔥 Selected Object ID:', selectedObjectId);
    console.log('🔥 Current Image ID:', currentImageId);
    console.log('🔥 Messages count:', messages?.length);
    console.log('🔥 Full body:', JSON.stringify({ projectId, roomKey, selectedObjectId, currentImageId }, null, 2));

    // ============================================================================
    // AUTHORITATIVE SOURCE OF TRUTH: Current Image ID comes from UI state
    // ============================================================================
    // The currentImageId is set by the user viewing a specific image in the UI.
    // It flows: UI state (currentImageId) → ChatWrapper → useChat → API body → here
    // We NEVER guess, infer, or fallback to a default image.
    // currentImageId must be explicitly provided in request body (can be null for first image).
    // If currentImageId is undefined (missing from body), the request is invalid.
    // If currentImageId is null and we're editing, the request is invalid.
    // ============================================================================
    
    // CRITICAL: Validate currentImageId is explicitly provided (not undefined)
    // It can be null for first image generation, but must be present in request body
    if (currentImageId === undefined) {
      return new Response('Current Image ID is required in request body (can be null for first image).', { status: 400 });
    }

    if (!projectId) {
      return new Response('Project ID is required', { status: 400 });
    }

    // CRITICAL: roomKey is required - no guessing, no fallback, no inference
    // This is the single authoritative source: the room the user selected in the UI
    if (!roomKey) {
      return new Response('Room Key is required. Please select a room.', { status: 400 });
    }

    const project = getProjectById(projectId);
    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    // Verify project belongs to user
    if (project.user_id !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // CRITICAL: Get room context from roomKey (client-side stable key)
    // For hackathon: use simple mapping instead of DB lookup
    const { getRoomContext, getRoomName } = await import('@/lib/ai/room-context');
    const roomContext = getRoomContext(roomKey);
    const roomName = getRoomName(roomKey);
    
    // Create a simple room object for system prompt
    const currentRoom = {
      id: roomKey, // Use key as ID for now
      name: roomName,
      type: roomKey,
      project_id: projectId,
      approved: true,
    };

    // CRITICAL: Hard-require currentImageId if images exist
    // For hackathon: get image by currentImageId directly (simplified)
    // TODO: Filter by roomKey when DB is fixed
    let existingImages: any[] = [];
    if (currentImageId !== null && currentImageId !== undefined) {
      // Get image directly by ID (simplified for hackathon)
      const image = getRoomImageById(currentImageId);
      if (image) {
        existingImages = [image];
      }
    } else {
      // If no currentImageId, check if any images exist in project
      // For hackathon: get all rooms and check for images
      const projectRooms = getRoomsByProjectId(projectId);
      for (const room of projectRooms) {
        const roomImages = getRoomImagesByRoomId(room.id);
        if (roomImages.length > 0) {
          existingImages = roomImages;
          break; // Use first room with images
        }
      }
    }
    
    // CRITICAL: Log room context for debugging
    console.log('[CHAT API] Room context:', {
      roomId: currentRoom.id,
      roomName: currentRoom.name,
      roomType: currentRoom.type,
      projectId: projectId,
    });
    const preferences = project.global_preferences
      ? JSON.parse(project.global_preferences)
      : {};

    // Save user message to database ONLY if it's new (no numeric DB ID)
    const lastMessage = messages[messages.length - 1];
    let userContent = '';
    let parsedInstruction = null;
    // Store generated image data in request scope (not globalThis for serverless compatibility)
    let generatedImageData: { imageUrl: string; detectedObjects: any[] } | null = null;
    // Store chat context (selected object, available objects, current image) for system prompt
    let chatContext: { 
      availableObjects: DetectedObject[]; 
      selectedObject: DetectedObject | null;
      currentImage: { imageId: number; imageUrl: string } | null;
    } | null = null;

    if (lastMessage?.role === 'user') {
      const hasDbId = lastMessage.id && !isNaN(Number(lastMessage.id));
      if (!hasDbId) {
        // Extract content from either content field or parts array
        if (typeof lastMessage.content === 'string') {
          userContent = lastMessage.content;
        } else if (Array.isArray(lastMessage.content)) {
          userContent = lastMessage.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        } else if (Array.isArray(lastMessage.parts)) {
          // Handle parts array format from frontend
          userContent = lastMessage.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        }

        if (userContent.trim()) {
          console.log('Saving new user message:', userContent.substring(0, 100));
          // For hackathon: save message without roomId (roomKey is client-side only)
          createMessage(projectId, 'user', userContent, null);

          // Trigger klein image generation if roomKey exists
          // Safety guard: do not generate images on empty input
          if (roomKey && userContent.trim().length > 0) {
            try {
              // CRITICAL: NO FALLBACK LOGIC - currentImageId is the single source of truth
              // If editing (selectedObjectId exists), currentImageId MUST be non-null
              // If generating and images exist, currentImageId MUST be non-null (user must select an image)
              // Only allow null currentImageId for first image generation (no images exist yet)
              
              let targetImage: RoomImage | null = null;
              
              if (selectedObjectId) {
                // CRITICAL: Editing requires currentImageId - NO FALLBACK
                if (currentImageId === null || currentImageId === undefined) {
                  throw new Error('Current Image ID is required when editing an object. Please select an image.');
                }
                
                targetImage = existingImages.find(img => img.id === currentImageId) || null;
                if (!targetImage) {
                  console.error(`[CHAT API] currentImageId ${currentImageId} not found. Available image IDs:`, existingImages.map(img => img.id));
                  throw new Error(`Image ID ${currentImageId} not found. Please select a valid image.`);
                }
                console.log(`[CHAT API] Editing with currentImageId ${currentImageId} (${targetImage.url.substring(0, 50)}...)`);
              } else {
                // New generation logic
                if (existingImages.length > 0) {
                  // Images exist - user MUST select one (currentImageId required)
                  if (currentImageId === null || currentImageId === undefined) {
                    throw new Error('Please select an image to generate a new design. Click on an image thumbnail first.');
                  }
                  
                  targetImage = existingImages.find(img => img.id === currentImageId) || null;
                  if (!targetImage) {
                    console.error(`[CHAT API] currentImageId ${currentImageId} not found. Available image IDs:`, existingImages.map(img => img.id));
                    throw new Error(`Image ID ${currentImageId} not found. Please select a valid image.`);
                  }
                  console.log(`[CHAT API] Generating with currentImageId ${currentImageId} (${targetImage.url.substring(0, 50)}...)`);
                } else {
                  // No images exist yet - first generation allowed with null currentImageId
                  console.log(`[CHAT API] Generating first image (no images exist yet)`);
                }
              }

              let availableObjects: DetectedObject[] = [];
              let previousImage: RoomImage | null = null;

              if (targetImage) {
                // Parse existing detected_items
                // 'null' = detection failed → don't use, try detection again
                // '[]' = detection succeeded but found no objects → valid, use empty array
                // '[{...}]' = detection succeeded with objects → use these
                if (targetImage.detected_items && 
                    targetImage.detected_items !== 'null' &&
                    targetImage.detected_items !== '[]' && 
                    targetImage.detected_items.trim() !== '') {
                  try {
                    const parsed = JSON.parse(targetImage.detected_items);
                    availableObjects = Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
                  } catch {
                    availableObjects = [];
                  }
                }

                // Always run detection if we don't have objects yet and detection hasn't failed
                // This ensures all images get detected objects
                if (availableObjects.length === 0 && targetImage.detected_items !== 'null') {
                  const detected = await detectObjects(targetImage.url, {
                    enhanceWithLLM: true, // Always enable LLM enhancement
                  });
                  if (detected !== null) {
                    availableObjects = detected;
                    updateRoomImageItems(targetImage.id, JSON.stringify(availableObjects));
                  } else {
                    // Detection failed, mark it so we don't retry immediately
                    updateRoomImageItems(targetImage.id, 'null');
                  }
                }

                if (availableObjects.length > 0) {
                  previousImage = {
                    imageUrl: targetImage.url,
                    objects: availableObjects,
                  };
                }
              }
              
              // Find selected object for system prompt context
              const selectedObject = selectedObjectId && availableObjects.length > 0
                ? availableObjects.find(obj => obj.id === selectedObjectId)
                : null;

              console.log('[CHAT API] Object selection context:', {
                selectedObjectId,
                currentImageId,
                targetImageId: targetImage?.id,
                availableObjectIds: availableObjects.map(o => o.id),
                availableObjectLabels: availableObjects.map(o => o.label),
                foundSelectedObject: selectedObject ? `${selectedObject.id}:${selectedObject.label}` : 'NOT FOUND',
              });

              // CRITICAL VALIDATION: If selectedObjectId is provided, it MUST exist
              if (selectedObjectId && !selectedObject) {
                const availableIds = availableObjects.map(o => `${o.id}:${o.label}`).join(', ');
                console.error(`[CHAT API] Selected object ID "${selectedObjectId}" not found in image ${targetImage?.id}. Available: [${availableIds}]`);
                throw new Error(`Selected object (ID: ${selectedObjectId}) not found in current image. Available objects: ${availableObjects.map(o => o.label).join(', ')}`);
              }

              // For hackathon: pass roomKey instead of roomId to parser
              parsedInstruction = await parseUserIntent(userContent, availableObjects, roomKey, selectedObjectId);
              console.log('[CHAT API] Parsed instruction:', JSON.stringify(parsedInstruction, null, 2));

              // CRITICAL: If object is selected but no previousImage, we can't edit - need to fetch it
              if (selectedObjectId && !previousImage && targetImage) {
                // We have the image but need to ensure objects are loaded
                if (availableObjects.length === 0) {
                  // Try to detect objects if we don't have them
                  const detected = await detectObjects(targetImage.url, {
                    enhanceWithLLM: true,
                  });
                  if (detected !== null && detected.length > 0) {
                    availableObjects = detected;
                    updateRoomImageItems(targetImage.id, JSON.stringify(availableObjects));
                    previousImage = {
                      imageUrl: targetImage.url,
                      objects: availableObjects,
                    };
                  }
                } else {
                  // We have objects, create previousImage
                  previousImage = {
                    imageUrl: targetImage.url,
                    objects: availableObjects,
                  };
                }
              }

              // GUARD: If selectedObjectId exists but no previousImage, throw error
              if (selectedObjectId && !previousImage) {
                throw new Error(`Cannot edit object: no image or objects available. Please ensure the image has detected objects.`);
              }

              const tasks = await buildKleinTasks(parsedInstruction, previousImage);
              console.log('Built klein tasks:', tasks.length);
              
              // GUARD: If object is selected, ensure we're using inpainting, not generation
              if (selectedObjectId && tasks.some(t => t.taskType === 'imageGeneration')) {
                throw new Error(`Invalid task type: selected object requires inpainting, not image generation`);
              }
              
              // Store available objects, selected object, and current image for system prompt (used later)
              // These will be used when building the system prompt for the chat AI
              chatContext = {
                availableObjects,
                selectedObject: selectedObjectId && availableObjects.length > 0
                  ? availableObjects.find(obj => obj.id === selectedObjectId)
                  : null,
                currentImage: targetImage ? {
                  imageId: targetImage.id,
                  imageUrl: targetImage.url,
                } : null,
              };

              const imageUrls = await executeKleinTasks(tasks);

              if (imageUrls.length > 0) {
                const finalImageUrl = imageUrls[imageUrls.length - 1];
                
                // For edits: reuse existing detected objects (sequential chaining)
                // For new generation: detect objects fresh
                let detectedObjects: DetectedObject[] | null = null;
                
                if (parsedInstruction.intent === 'edit_objects' && previousImage && previousImage.objects.length > 0) {
                  // Keep same object IDs for edits (no re-detection needed)
                  // Objects maintain their identity through edits
                  detectedObjects = previousImage.objects;
                } else {
                  // New generation: detect objects with LLM enhancement enabled
                  // LLM enhancement adds colors, styles, materials from Python service
                  detectedObjects = await detectObjects(finalImageUrl, {
                    enhanceWithLLM: true, // Always enable LLM enhancement
                  });
                }

                // Only save detected objects if detection succeeded
                // null means detection failed → save 'null' string (sentinel)
                // [] means detection succeeded but found no objects → save '[]'
                // [{...}] means detection succeeded with objects → save '[{...}]'
                const detectedItemsJson = detectedObjects !== null 
                  ? JSON.stringify(detectedObjects) 
                  : null;

                // For hackathon: find a room ID from the project to associate the image
                // TODO: Map roomKey to roomId when DB is fixed
                // For now, get first room ID from project
                const projectRooms = getRoomsByProjectId(projectId);
                // Simplified: create image with first available room ID
                // In production, this would map roomKey → roomId
                const targetRoomId = projectRooms.length > 0 ? projectRooms[0].id : 1;
                
                const newImage = createRoomImage(
                  targetRoomId,
                  finalImageUrl,
                  userContent,
                  'perspective',
                  detectedItemsJson
                );

                // Store image data in request scope for response headers
                generatedImageData = {
                  imageUrl: finalImageUrl,
                  detectedObjects: detectedObjects || [],
                };
              }
            } catch (error) {
              console.error('Klein generation error in chat:', error);
            }
          }
        } else {
          console.log('Skipping empty user message');
        }
      } else {
        console.log('Skipping user message with DB ID:', lastMessage.id);
      }
    }

    // Convert UI messages to model messages format
    const modelMessages = await convertToModelMessages(messages);
    console.log('Model messages count:', modelMessages.length);

    // Create AI tools with project context
    // For hackathon: pass null for roomId (tools don't need it with roomKey approach)
    const tools = createAiTools(projectId, null, preferences);
    console.log('Tools available:', Object.keys(tools));

    // Stream response with tools - use experimental_continueSteps to handle multi-step
    console.log('Starting streamText...');

    // Get available objects and current image for system prompt context
    // Use context from image generation if available, otherwise fetch fresh
    let availableObjectsForPrompt: DetectedObject[] = [];
    let selectedObjectForPrompt: DetectedObject | null = null;
    let currentImageForPrompt: { imageId: number; imageUrl: string } | null = null;
    
    // CRITICAL: Always fetch image context if currentImageId is provided
    // This ensures AI knows about the current image even if chatContext doesn't have it
    if (currentImageId !== null && currentImageId !== undefined) {
      const targetImage = getRoomImageById(currentImageId);
      console.log('[CHAT API] Fetching image context:', {
        currentImageId,
        found: !!targetImage,
        imageUrl: targetImage?.url?.substring(0, 50),
      });
      
      if (targetImage) {
        currentImageForPrompt = {
          imageId: targetImage.id,
          imageUrl: targetImage.url,
        };
        
        // Parse detected objects
        if (targetImage.detected_items && 
            targetImage.detected_items !== 'null' &&
            targetImage.detected_items !== '[]' && 
            targetImage.detected_items.trim() !== '') {
          try {
            const parsed = JSON.parse(targetImage.detected_items);
            availableObjectsForPrompt = Array.isArray(parsed) ? parsed : [];
            console.log('[CHAT API] Found objects in image:', availableObjectsForPrompt.length);
          } catch (e) {
            console.error('[CHAT API] Failed to parse detected_items:', e);
            availableObjectsForPrompt = [];
          }
        } else {
          console.log('[CHAT API] No detected_items in image (or empty/null)');
        }
        
        // Find selected object if provided
        if (selectedObjectId && availableObjectsForPrompt.length > 0) {
          selectedObjectForPrompt = availableObjectsForPrompt.find(obj => obj.id === selectedObjectId) || null;
          console.log('[CHAT API] Selected object:', selectedObjectForPrompt ? `${selectedObjectForPrompt.label} (${selectedObjectForPrompt.id})` : 'NOT FOUND');
        }
      } else {
        console.error('[CHAT API] Image not found for currentImageId:', currentImageId);
      }
    }
    
    // Use chatContext if available (from image generation during this request)
    // But don't override if we already have image context from currentImageId
    if (chatContext && !currentImageForPrompt) {
      availableObjectsForPrompt = chatContext.availableObjects || [];
      selectedObjectForPrompt = chatContext.selectedObject || null;
      currentImageForPrompt = chatContext.currentImage || null;
    }

    // Build system prompt with room context
    const systemPrompt = getSystemPrompt(project, currentRoom ?? null, selectedObjectForPrompt, availableObjectsForPrompt, currentImageForPrompt);
    console.log('[CHAT API] System prompt context:', {
      roomName: currentRoom?.name,
      roomType: currentRoom?.type,
      hasImageContext: !!currentImageForPrompt,
      imageId: currentImageForPrompt?.imageId,
      imageUrl: currentImageForPrompt?.imageUrl?.substring(0, 50),
      hasSelectedObject: !!selectedObjectForPrompt,
      selectedObjectLabel: selectedObjectForPrompt?.label,
      availableObjectsCount: availableObjectsForPrompt.length,
      promptIncludesRoom: systemPrompt.includes(currentRoom?.name || ''),
      promptIncludesImage: systemPrompt.includes('currently viewing'),
    });
    
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5), // Allow up to 5 tool execution rounds
      onStepFinish: (step) => {
        console.log('Step finished:', {
          text: step.text?.substring(0, 100),
          toolCalls: step.toolCalls?.map((tc) => tc.toolName),
          toolResults: step.toolResults?.length,
          finishReason: step.finishReason,
        });
      },
    });

    // Return UI message stream response (supports tool calls and text)
    const response = result.toUIMessageStreamResponse();

    // Add parsed instruction to response headers if available
    if (parsedInstruction) {
      response.headers.set('X-Parsed-Instruction', JSON.stringify(parsedInstruction));
    }

    // Add image data to response headers if image was generated
    if (generatedImageData) {
      response.headers.set('X-Generated-Image-Url', generatedImageData.imageUrl);
      response.headers.set('X-Generated-Image-Objects', JSON.stringify(generatedImageData.detectedObjects));
    }

    // Save to DB in the background (don't await to not block streaming)
    (async () => {
      try {
        const [text, toolCalls, toolResults, finishReason] = await Promise.all([
          result.text,
          result.toolCalls,
          result.toolResults,
          result.finishReason,
        ]);

        console.log('Full stream completed:', {
          text: text?.substring(0, 200),
          toolCallCount: toolCalls?.length,
          finishReason,
        });

        // Save assistant message to database after stream ends
        let toolInvocations = undefined;

        if (toolCalls && toolCalls.length > 0) {
          toolInvocations = toolCalls.map((call: any, index: number) => {
            const toolResult = toolResults?.[index] as any;
            return {
              state: 'result' as const,
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              args: call.args,
              result: toolResult?.result ?? null,
            };
          });
        }

        // Only save if there's actual content
        if (text?.trim() || toolInvocations) {
          console.log('Saving assistant message to DB');
          // For hackathon: save message without roomId (roomKey is client-side only)
          // TODO: Map roomKey to roomId when saving messages
          createMessage(
            projectId,
            'assistant',
            text || '',
            null, // roomId - not used with roomKey approach
            toolInvocations ? JSON.stringify(toolInvocations) : undefined
          );
        }
      } catch (error) {
        console.error('Error saving message:', error);
      }
    })();

    return response;
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Chat failed',
      { status: 500 }
    );
  }
}
