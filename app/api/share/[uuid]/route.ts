import { NextResponse } from 'next/server';
import {
  getSharedDesignById,
  getProjectWithRoomsAndImages,
} from '@/lib/db/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;

    const sharedDesign = getSharedDesignById(uuid);
    if (!sharedDesign) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }

    const data = getProjectWithRoomsAndImages(sharedDesign.project_id);
    if (!data) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Return public data (without user info)
    return NextResponse.json({
      project: {
        name: data.project.name,
        preferences: data.project.global_preferences
          ? JSON.parse(data.project.global_preferences)
          : {},
      },
      rooms: data.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        images: room.images.map((img) => ({
          id: img.id,
          url: img.url,
          prompt: img.prompt,
          view_type: img.view_type,
          detected_items: img.detected_items ? JSON.parse(img.detected_items) : [],
        })),
      })),
    });
  } catch (error) {
    console.error('Get share error:', error);
    return NextResponse.json({ error: 'Failed to get share' }, { status: 500 });
  }
}
