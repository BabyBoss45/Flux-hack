import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getRoomById, getProjectById, getRoomImagesByRoomId, createRoomImage } from '@/lib/db/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
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

    const normalizedImages = images.map((img) => ({
      id: img.id,
      room_id: img.room_id,
      url: img.url,
      prompt: img.prompt,
      view_type: img.view_type,
      detected_items: img.detected_items ?? '[]',
      is_final: img.is_final ?? 0,
      created_at: img.created_at,
    }));

    return NextResponse.json({ images: normalizedImages });
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
    const session = await auth.api.getSession({ headers: await headers() });
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
