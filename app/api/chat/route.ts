import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getProjectById, getRoomById, createMessage, createRoomMessage, getRoomImagesByRoomId } from '@/lib/db/queries';
import { createAiTools } from '@/lib/ai/tools';
import { getSystemPrompt } from '@/lib/ai/prompts';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    console.log('=== Chat API Request ===');
    console.log('Raw body keys:', Object.keys(body));

    const { messages, projectId, roomId } = body;

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

    if (lastMessage?.role === 'user') {
      const hasDbId = lastMessage.id && !isNaN(Number(lastMessage.id));
      if (!hasDbId) {
        // Extract content from either content field or parts array
        if (typeof lastMessage.content === 'string') {
          userContent = lastMessage.content;
        } else if (Array.isArray(lastMessage.content)) {
          userContent = lastMessage.content
            .filter((p: { type: string }) => p.type === 'text')
            .map((p: { type: string; text?: string }) => p.text || '')
            .join('');
        } else if (Array.isArray(lastMessage.parts)) {
          // Handle parts array format from frontend
          userContent = lastMessage.parts
            .filter((p: { type: string }) => p.type === 'text')
            .map((p: { type: string; text?: string }) => p.text || '')
            .join('');
        }

        if (userContent.trim()) {
          console.log('Saving new user message:', userContent.substring(0, 100));
          if (roomId) {
            createRoomMessage(projectId, roomId, 'user', userContent);
          } else {
            createMessage(projectId, 'user', userContent, undefined);
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

    // Build image context for system prompt
    let imageContext = undefined;
    if (roomId) {
      const roomImages = getRoomImagesByRoomId(Number(roomId));
      if (roomImages.length > 0) {
        const latestImage = roomImages[0];
        let detectedObjects: string[] = [];
        if (latestImage.detected_items && latestImage.detected_items !== 'null') {
          try {
            const parsed = JSON.parse(latestImage.detected_items);
            detectedObjects = Array.isArray(parsed) ? parsed.map((obj: { label?: string; name?: string }) => obj.label || obj.name || 'object') : [];
          } catch { }
        }
        imageContext = {
          hasImage: true,
          imageUrl: latestImage.url,
          prompt: latestImage.prompt,
          detectedObjects,
        };
        console.log('Image context for system prompt:', { hasImage: true, objectCount: detectedObjects.length });
      }
    }

    // Create AI tools with project context
    const tools = createAiTools(projectId, roomId, preferences);
    console.log('Tools available:', Object.keys(tools));

    // Stream response with tools - use experimental_continueSteps to handle multi-step
    console.log('Starting streamText...');

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: getSystemPrompt(project, currentRoom ?? null, imageContext),
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
          toolInvocations = toolCalls.map((call, index) => {
            const toolResult = toolResults?.[index];
            // Access properties safely - toolCalls can be typed or dynamic
            const callObj = call as { toolCallId: string; toolName: string; args?: unknown };
            const resultObj = toolResult as { result?: unknown } | undefined;
            return {
              state: 'result' as const,
              toolCallId: callObj.toolCallId,
              toolName: callObj.toolName,
              args: callObj.args,
              result: resultObj?.result ?? null,
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
