import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getProjectById, getMessagesByProjectId, getRoomMessagesByRoomId } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);

    // Get roomId from query params if provided
    const { searchParams } = new URL(request.url);
    const roomIdParam = searchParams.get('roomId');
    const roomId = roomIdParam ? parseInt(roomIdParam, 10) : null;

    const project = getProjectById(projectId);
    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    // Verify project belongs to user
    if (project.user_id !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fetch messages - filter by room if roomId provided
    const messages = roomId
      ? getRoomMessagesByRoomId(projectId, roomId)
      : getMessagesByProjectId(projectId);

    // Transform messages to AI SDK UIMessage format
    const formattedMessages = messages.map((msg) => {
      // Build the base message in UIMessage format
      const message: Record<string, unknown> = {
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content || '',
        createdAt: new Date(msg.created_at),
      };

      // Parse and add tool invocations if present
      if (msg.tool_calls && msg.tool_calls !== '[]') {
        try {
          const toolInvocations = JSON.parse(msg.tool_calls);
          if (Array.isArray(toolInvocations) && toolInvocations.length > 0) {
            message.toolInvocations = toolInvocations;
          }
        } catch (e) {
          console.error('Failed to parse tool calls:', e);
        }
      }

      return message;
    });

    console.log(`Returning ${formattedMessages.length} messages for project ${projectId}, room ${roomId}`);

    return Response.json({ messages: formattedMessages });
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return new Response(
      error instanceof Error ? error.message : 'Failed to fetch messages',
      { status: 500 }
    );
  }
}
