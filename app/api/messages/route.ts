import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, getMessagesByProjectId, getMessagesByRoomId } from '@/lib/db/queries';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      logger.warn('messages', 'Unauthorized request');
      return new Response('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectIdParam = searchParams.get('projectId');
    const roomIdParam = searchParams.get('roomId');

    if (!projectIdParam) {
      logger.warn('messages', 'Request missing projectId');
      return new Response('Project ID is required', { status: 400 });
    }

    const projectId = parseInt(projectIdParam, 10);
    if (isNaN(projectId)) {
      logger.warn('messages', 'Invalid projectId', { projectIdParam });
      return new Response('Invalid Project ID', { status: 400 });
    }

    // Verify project exists and belongs to user
    const project = getProjectById(projectId);
    if (!project) {
      logger.warn('messages', 'Project not found', { projectId });
      return new Response('Project not found', { status: 404 });
    }

    if (project.user_id !== session.user.id) {
      logger.warn('messages', 'Project access forbidden', { projectId, userId: session.user.id });
      return new Response('Forbidden', { status: 403 });
    }

    logger.debug('messages', 'Fetching messages', { projectId, roomId: roomIdParam });

    // Fetch messages - either by room or project
    let messages;
    if (roomIdParam) {
      const roomId = parseInt(roomIdParam, 10);
      if (isNaN(roomId)) {
        logger.warn('messages', 'Invalid roomId', { roomIdParam });
        return new Response('Invalid Room ID', { status: 400 });
      }
      messages = getMessagesByRoomId(roomId);
    } else {
      messages = getMessagesByProjectId(projectId);
    }

    logger.info('messages', 'Messages fetched successfully', {
      projectId,
      roomId: roomIdParam,
      count: messages.length,
    });

    // Transform to format expected by client
    const transformedMessages = messages.map((msg) => ({
      id: msg.id.toString(),
      role: msg.role,
      content: msg.content,
      toolCalls: msg.tool_calls,
      createdAt: msg.created_at,
    }));

    return Response.json({ messages: transformedMessages });
  } catch (error) {
    logger.error('messages', 'Failed to fetch messages', { error });
    return new Response(
      error instanceof Error ? error.message : 'Failed to fetch messages',
      { status: 500 }
    );
  }
}
