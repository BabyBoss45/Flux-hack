import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import {
  getProjectById,
  areAllRoomsApproved,
  getSharedDesignByProjectId,
  createSharedDesign,
} from '@/lib/db/queries';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if all rooms are approved
    if (!areAllRoomsApproved(projectId)) {
      return NextResponse.json(
        { error: 'All rooms must be approved before sharing' },
        { status: 400 }
      );
    }

    // Check if share already exists
    let sharedDesign = getSharedDesignByProjectId(projectId);

    if (!sharedDesign) {
      const shareId = uuidv4();
      sharedDesign = createSharedDesign(shareId, projectId);
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/share/${sharedDesign?.id}`;

    return NextResponse.json({ url: shareUrl, id: sharedDesign?.id });
  } catch (error) {
    console.error('Create share error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
