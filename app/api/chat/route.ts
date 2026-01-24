import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, getRoomById, createMessage } from '@/lib/db/queries';
import { createAiTools } from '@/lib/ai/tools';
import { getSystemPrompt } from '@/lib/ai/prompts';

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
    if (lastMessage?.role === 'user') {
      const hasDbId = lastMessage.id && !isNaN(Number(lastMessage.id));
      if (!hasDbId) {
        // Extract content from either content field or parts array
        let content = '';

        if (typeof lastMessage.content === 'string') {
          content = lastMessage.content;
        } else if (Array.isArray(lastMessage.content)) {
          content = lastMessage.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        } else if (Array.isArray(lastMessage.parts)) {
          // Handle parts array format from frontend
          content = lastMessage.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
        }

        if (content.trim()) {
          console.log('Saving new user message:', content.substring(0, 100));
          createMessage(projectId, 'user', content, roomId);
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
          createMessage(
            projectId,
            'assistant',
            text || '',
            roomId,
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
