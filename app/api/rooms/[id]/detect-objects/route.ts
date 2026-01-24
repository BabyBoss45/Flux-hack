import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getRoomById, getProjectById, getRoomImagesByRoomId, updateRoomImageItems } from '@/lib/db/queries';
import { detectObjects } from '@/lib/klein/object-detection';

/**
 * POST /api/rooms/[id]/detect-objects
 * 
 * Ensures all images in a room have detected objects.
 * Runs detection for images that don't have detected_items yet.
 */
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
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const images = getRoomImagesByRoomId(roomId);
    const results = [];

    for (const image of images) {
      // Check if image needs detection
      // Need detection if: null, undefined, empty string, 'null', or '[]' (empty array means no objects detected yet)
      const items = image.detected_items;
      const needsDetection = 
        !items || 
        items === 'null' || 
        items.trim() === '' ||
        items === '[]';

      if (needsDetection) {
        try {
          const detected = await detectObjects(image.url, {
            enhanceWithLLM: true, // Always enable LLM enhancement
          });
          
          if (detected !== null) {
            updateRoomImageItems(image.id, JSON.stringify(detected));
            results.push({ imageId: image.id, status: 'detected', count: detected.length });
          } else {
            updateRoomImageItems(image.id, 'null');
            results.push({ imageId: image.id, status: 'failed' });
          }
        } catch (error) {
          console.error(`Detection failed for image ${image.id}:`, error);
          results.push({ imageId: image.id, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        }
      } else {
        results.push({ imageId: image.id, status: 'already_detected' });
      }
    }

    return NextResponse.json({
      success: true,
      roomId,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Detect objects error:', error);
    return NextResponse.json(
      { error: 'Failed to detect objects', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

