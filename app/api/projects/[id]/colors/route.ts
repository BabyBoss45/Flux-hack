import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  getProjectById,
  getColorPaletteByProjectId,
  addColorsToPalette,
} from '@/lib/db/queries';

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
    const project = getProjectById(projectId);

    if (!project || project.user_id !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const colors = getColorPaletteByProjectId(projectId);
    return Response.json({ colors });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to fetch colors',
      { status: 500 }
    );
  }
}

export async function POST(
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
    const project = getProjectById(projectId);

    if (!project || project.user_id !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    const body = await request.json();
    const { colors } = body;

    if (!Array.isArray(colors)) {
      return new Response('Colors must be an array', { status: 400 });
    }

    addColorsToPalette(projectId, colors);
    return Response.json({ success: true });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to add colors',
      { status: 500 }
    );
  }
}
