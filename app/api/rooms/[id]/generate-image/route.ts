import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import {
  getRoomById,
  getProjectById,
  createRoomImage,
} from '@/lib/db/queries';
import { generateImage } from '@/lib/bfl/client';
import { pollForResult } from '@/lib/bfl/polling';
import { buildImagePrompt } from '@/lib/ai/prompts';

interface GeneratePayload {
  action?: string;
  roomId?: number;
  description: string;
  viewType?: 'perspective' | 'wide' | 'detail' | 'overhead';
  dimensions?: {
    width?: number;
    height?: number;
  };
  style?: string;
  colorPalette?: string;
  camera?: {
    angle?: string;
    lens?: string;
  };
  runware?: {
    steps?: number;
    cfgScale?: number;
    model?: string;
    numberResults?: number;
  };
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
    const roomIdFromPath = parseInt(id, 10);

    const room = getRoomById(roomIdFromPath);
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

    const body: GeneratePayload = await request.json();

    if (!body.description) {
      return NextResponse.json(
        { error: 'description is required' },
        { status: 400 }
      );
    }

    const viewType = body.viewType || 'perspective';

    // Merge project preferences with payload hints
    const basePreferences = project.global_preferences
      ? JSON.parse(project.global_preferences)
      : {};

    const mergedPreferences = {
      ...basePreferences,
      ...(body.style ? { style: body.style } : {}),
      ...(body.colorPalette ? { colors: body.colorPalette } : {}),
    } as Record<string, string>;

    // Build the final prompt using existing helper
    const prompt = buildImagePrompt(body.description, room, mergedPreferences);

    const width = body.dimensions?.width || 1024;
    const height = body.dimensions?.height || 768;
    const steps = body.runware?.steps;
    const guidance = body.runware?.cfgScale;
    const model = body.runware?.model || 'runware:400@4';

    // Kick off Runware-backed generation
    const job = await generateImage({
      prompt,
      width,
      height,
      steps,
      guidance,
      model,
    });

    const result = await pollForResult(job.id);

    if (!result.success || !result.imageUrl) {
      return NextResponse.json(
        { error: result.error || 'Generation failed' },
        { status: 500 }
      );
    }

    const image = createRoomImage(
      roomIdFromPath,
      result.imageUrl,
      body.description,
      viewType
    );

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      imageId: image?.id,
      viewType,
    });
  } catch (error) {
    console.error('Generate room image error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate image',
      },
      { status: 500 }
    );
  }
}


