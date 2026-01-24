import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
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

    const { messages, projectId, roomId } = await request.json();

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

    // Transform messages from parts format to content format if needed
    const transformedMessages = messages.map((msg: Record<string, unknown>) => {
      // If message already has content, use it as-is
      if (msg.content !== undefined) {
        return msg;
      }
      // Transform parts array to content string
      if (Array.isArray(msg.parts)) {
        const textParts = msg.parts
          .filter((part: { type?: string }) => part.type === 'text')
          .map((part: { text?: string }) => part.text || '')
          .join('');
        return { ...msg, content: textParts, parts: undefined };
      }
      return { ...msg, content: '' };
    });

    // Save user message to database
    const lastMessage = transformedMessages[transformedMessages.length - 1];
    if (lastMessage?.role === 'user') {
      const content = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
      createMessage(projectId, 'user', content || '', roomId);
    }

    // Create AI tools with project context
    const tools = createAiTools(projectId, roomId, preferences);

    // Stream response
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: getSystemPrompt(project, currentRoom ?? null),
      messages: transformedMessages,
      tools,
      onFinish: async ({ text, toolCalls }) => {
        // Save assistant message to database
        createMessage(
          projectId,
          'assistant',
          text || '',
          roomId,
          toolCalls ? JSON.stringify(toolCalls) : undefined
        );
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      error instanceof Error ? error.message : 'Chat failed',
      { status: 500 }
    );
  }
}
