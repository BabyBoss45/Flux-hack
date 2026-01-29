import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/bfl/client';
import { pollForResult } from '@/lib/bfl/polling';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, width, height, async: asyncMode } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Start the generation job
    const job = await generateImage({ prompt, width, height });

    // If async mode, return job ID for client polling
    if (asyncMode) {
      return NextResponse.json({ jobId: job.id, status: 'pending' });
    }

    // Otherwise, poll and wait for result
    const result = await pollForResult(job.id);

    if (result.success && result.imageUrl) {
      return NextResponse.json({ imageUrl: result.imageUrl });
    }

    return NextResponse.json({ error: result.error || 'Generation failed' }, { status: 500 });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
