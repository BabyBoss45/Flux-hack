import { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, updateProjectPreferences } from '@/lib/db/queries';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
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
    const { building_type, architecture_style, atmosphere } = body;

    updateProjectPreferences(projectId, {
      building_type,
      architecture_style,
      atmosphere,
    });

    return Response.json({ success: true });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to update preferences',
      { status: 500 }
    );
  }
}
