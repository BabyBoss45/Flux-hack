import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getRoomById, getProjectById, getRoomImagesByRoomId, createRoomImage } from '@/lib/db/queries';

export async function GET(
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

    const images = getRoomImagesByRoomId(roomId);
    
    // Ensure all images have detected_items and explicitly include it
    // 'null' = detection failed, '[]' = not detected or empty, '[{...}]' = has objects
    const normalizedImages = images.map((img) => {
      const normalized = {
        id: img.id,
        room_id: img.room_id,
        url: img.url,
        prompt: img.prompt,
        view_type: img.view_type,
        detected_items: img.detected_items ?? '[]',
        is_final: img.is_final ?? 0,
        created_at: img.created_at,
      };
      
      // Debug: Log each image being normalized
      console.log(`ROOM IMAGE FROM DB:`, {
        id: normalized.id,
        url: normalized.url,
        detected_items: normalized.detected_items,
        detected_items_type: typeof normalized.detected_items,
        detected_items_length: normalized.detected_items?.length,
        detected_items_is_null: normalized.detected_items === null,
        detected_items_is_undefined: normalized.detected_items === undefined,
        detected_items_is_empty: normalized.detected_items === '',
        all_keys: Object.keys(normalized),
        full_object: normalized,
      });
      
      return normalized;
    });
    
    // Debug: Log what we're sending to frontend
    console.log('=== SENDING TO FRONTEND ===');
    const responsePayload = { images: normalizedImages };
    console.log('Response payload keys:', Object.keys(responsePayload));
    console.log('First image in response:', responsePayload.images[0] ? {
      id: responsePayload.images[0].id,
      has_detected_items: 'detected_items' in responsePayload.images[0],
      detected_items: responsePayload.images[0].detected_items,
      all_keys: Object.keys(responsePayload.images[0]),
    } : 'No images');
    console.log('Full response JSON:', JSON.stringify(responsePayload, null, 2));
    
    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Get room images error:', error);
    return NextResponse.json({ error: 'Failed to get room images' }, { status: 500 });
  }
}

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

    const { url, prompt, viewType, detectedItems } = await request.json();

    if (!url || !prompt) {
      return NextResponse.json({ error: 'URL and prompt are required' }, { status: 400 });
    }

    const image = createRoomImage(
      roomId,
      url,
      prompt,
      viewType || 'perspective',
      detectedItems || '[]'
    );

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Create room image error:', error);
    return NextResponse.json({ error: 'Failed to create room image' }, { status: 500 });
  }
}
