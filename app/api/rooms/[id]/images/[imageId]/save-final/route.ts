import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getRoomById, getProjectById, getRoomImageById, setImageAsFinal } from '@/lib/db/queries';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, imageId } = await params;
    const roomId = parseInt(id, 10);
    const imgId = parseInt(imageId, 10);

    // Validate room exists
    const room = getRoomById(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Validate project ownership
    const project = getProjectById(room.project_id);
    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate image exists and belongs to this room
    const image = getRoomImageById(imgId);
    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    if (image.room_id !== roomId) {
      return NextResponse.json({ error: 'Image does not belong to this room' }, { status: 400 });
    }

    // Mark image as final
    setImageAsFinal(imgId, roomId);

    console.log(`[SaveFinal] Image ${imgId} marked as final for room ${roomId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Image saved as final design',
      imageId: imgId,
      roomId: roomId
    });
  } catch (error) {
    console.error('Save final image error:', error);
    return NextResponse.json({ error: 'Failed to save final image' }, { status: 500 });
  }
}
