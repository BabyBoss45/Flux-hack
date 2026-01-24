import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getRoomById, approveRoom, getProjectById, getRoomImagesByRoomId } from '@/lib/db/queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const roomId = parseInt(id, 10);
    const room = getRoomById(roomId);

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const project = getProjectById(room.project_id);
    if (project?.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if room has at least one image
    const images = getRoomImagesByRoomId(roomId);
    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Room must have at least one design image before approval' },
        { status: 400 }
      );
    }

    approveRoom(roomId);

    const updated = getRoomById(roomId);
    return NextResponse.json({ room: updated, message: 'Room approved successfully' });
  } catch (error) {
    console.error('Approve room error:', error);
    return NextResponse.json({ error: 'Failed to approve room' }, { status: 500 });
  }
}
