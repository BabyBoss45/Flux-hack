import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, getRoomById, createMessage, createRoomMessage, getRoomImagesByRoomId, createRoomImage, updateRoomImageItems } from '@/lib/db/queries';
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

    const { messages, projectId, roomId, selectedObjectId } = body;

    console.log('Extracted - Project ID:', projectId);
    console.log('Extracted - Room ID:', roomId);
    console.log('Extracted - Messages count:', messages?.length);

    if (!projectId) {
      return new Response('Project ID is required', { status: 400 });
    }

    const project = getProjectById(projectId);
    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    // Verify project belongs to user
    if (project.user_id !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const currentRoom = roomId ? getRoomById(roomId) : null;
    const preferences = project.global_preferences
      ? JSON.parse(project.global_preferences)
      : {};

    // Save user message to database ONLY if it's new (no numeric DB ID)
    const lastMessage = messages[messages.length - 1];
    let userContent = '';
    let parsedInstruction = null;
    // Store generated image data in request scope (not globalThis for serverless compatibility)
    let generatedImageData: { imageUrl: string; detectedObjects: any[] } | null = null;

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
          if (roomId) {
            createRoomMessage(projectId, roomId, 'user', userContent);
          } else {
            createMessage(projectId, 'user', userContent, undefined);
          }

          // Trigger klein image generation if roomId exists
          // Safety guard: do not generate images on empty input
          if (roomId && userContent.trim().length > 0) {
            // Declare outside try block so they're accessible in catch for error logging
            let availableObjects: DetectedObject[] = [];
            let previousImage: RoomImage | null = null;

            try {
              const existingImages = getRoomImagesByRoomId(Number(roomId));
              const latestImage = existingImages[0] || null;

              if (latestImage) {
                // Parse existing detected_items
                // 'null' = detection failed → don't use, try detection again
                // '[]' = detection succeeded but found no objects → valid, use empty array
                // '[{...}]' = detection succeeded with objects → use these
                if (latestImage.detected_items &&
                    latestImage.detected_items !== 'null' &&
                    latestImage.detected_items !== '[]' &&
                    latestImage.detected_items.trim() !== '') {
                  try {
                    const parsed = JSON.parse(latestImage.detected_items);
                    availableObjects = Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
                  } catch {
                    availableObjects = [];
                  }
                }

                // Only run detection if we don't have objects yet and detection hasn't failed
                if (availableObjects.length === 0 && latestImage.detected_items !== 'null') {
                  const detected = await detectObjects(latestImage.url);
                  if (detected !== null) {
                    availableObjects = detected;
                    updateRoomImageItems(latestImage.id, JSON.stringify(availableObjects));
                  } else {
                    // Detection failed, mark it so we don't retry immediately
                    updateRoomImageItems(latestImage.id, 'null');
                  }
                }

                if (availableObjects.length > 0) {
                  previousImage = {
                    imageUrl: latestImage.url,
                    objects: availableObjects,
                  };
                }
              }

              parsedInstruction = await parseUserIntent(userContent, availableObjects, String(roomId), selectedObjectId);

              // Enhanced logging for debugging
              console.log('Klein parse result:', {
                intent: parsedInstruction.intent,
                editsCount: parsedInstruction.edits?.length ?? 0,
                editTargets: parsedInstruction.edits?.map(e => e.target),
                availableLabels: availableObjects.map(o => o.label || o.name),
                roomId: parsedInstruction.roomId,
              });

              const tasks = await buildKleinTasks(parsedInstruction, previousImage);
              console.log('Built klein tasks:', tasks.length);

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
                  // New generation: detect objects
                  detectedObjects = await detectObjects(finalImageUrl);
                }

                // Only save detected objects if detection succeeded
                // null means detection failed → save 'null' string (sentinel)
                // [] means detection succeeded but found no objects → save '[]'
                // [{...}] means detection succeeded with objects → save '[{...}]'
                const detectedItemsJson = detectedObjects !== null
                  ? JSON.stringify(detectedObjects)
                  : null;

                const newImage = createRoomImage(
                  Number(roomId),
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
              // Enhanced error logging with context
              console.error('Klein generation error:', {
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                instruction: parsedInstruction,
                previousImageUrl: previousImage?.imageUrl,
                availableObjects: availableObjects.map((o: DetectedObject) => ({
                  id: o.id,
                  label: o.label || o.name,
                  hasBbox: Boolean(o.bbox),
                })),
                userContent: userContent.substring(0, 200),
              });

              // Note: We don't throw here - we let the AI respond naturally
              // The AI can explain what went wrong based on the context
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
    const tools = createAiTools(projectId, roomId, preferences);
    console.log('Tools available:', Object.keys(tools));

    // Stream response with tools - use experimental_continueSteps to handle multi-step
    console.log('Starting streamText...');

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: getSystemPrompt(project, currentRoom ?? null),
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
          if (roomId) {
            createRoomMessage(
              projectId,
              roomId,
              'assistant',
              text || '',
              toolInvocations ? JSON.stringify(toolInvocations) : undefined
            );
          } else {
            createMessage(
              projectId,
              'assistant',
              text || '',
              undefined,
              toolInvocations ? JSON.stringify(toolInvocations) : undefined
            );
          }
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
