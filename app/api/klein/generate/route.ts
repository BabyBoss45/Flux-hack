import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getRoomById, getProjectById, getRoomImagesByRoomId, createRoomImage, updateRoomImageItems } from '@/lib/db/queries';
import { parseUserIntent } from '@/lib/klein/parser';
import { buildKleinTasks } from '@/lib/klein/task-builder';
import { executeKleinTasks } from '@/lib/klein/runware-client';
import { detectObjects } from '@/lib/klein/object-detection';
import type { RoomImage, DetectedObject } from '@/lib/klein/types';

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userText, roomId } = body;

    if (!userText || typeof userText !== 'string') {
      return NextResponse.json({ error: 'userText is required' }, { status: 400 });
    }

    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
    }

    const room = getRoomById(Number(roomId));
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

    const existingImages = getRoomImagesByRoomId(Number(roomId));
    const latestImage = existingImages[0] || null;

    let availableObjects: DetectedObject[] = [];
    let previousImage: RoomImage | null = null;

    if (latestImage) {
      try {
        const parsed = latestImage.detected_items ? JSON.parse(latestImage.detected_items) : [];
        availableObjects = Array.isArray(parsed) ? parsed : [];
      } catch {
        availableObjects = [];
      }

      if (availableObjects.length === 0) {
        const detected = await detectObjects(latestImage.url);
        if (detected !== null) {
          availableObjects = detected;
          updateRoomImageItems(latestImage.id, JSON.stringify(availableObjects));
        }
      }

      previousImage = {
        imageUrl: latestImage.url,
        objects: availableObjects,
      };
    }

    const instruction = await parseUserIntent(userText, availableObjects, String(roomId));

    const tasks = await buildKleinTasks(instruction, previousImage);

    const imageUrls = await executeKleinTasks(tasks);

    if (imageUrls.length === 0) {
      return NextResponse.json({ error: 'No images generated' }, { status: 500 });
    }

    const finalImageUrl = imageUrls[imageUrls.length - 1];

    const detectedObjects = await detectObjects(finalImageUrl);

    // Only save detected objects if detection succeeded
    // null means detection failed → save 'null' string (sentinel)
    // [] means detection succeeded but found no objects → save '[]'
    // [{...}] means detection succeeded with objects → save '[{...}]'
    const detectedItemsJson = detectedObjects !== null 
      ? JSON.stringify(detectedObjects) 
      : null;

    const newImage = createRoomImage(
      Number(roomId),
      finalImageUrl,
      userText,
      'perspective',
      detectedItemsJson
    );

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      imageId: newImage?.id,
      objects: detectedObjects,
      instruction,
    });
  } catch (error) {
    console.error('Klein generation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Generation failed',
      },
      { status: 500 }
    );
  }
}

