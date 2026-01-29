import { NextResponse } from 'next/server';
import { checkJobStatus } from '@/lib/bfl/polling';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    const status = await checkJobStatus(jobId);

    if (!status) {
      return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
    }

    // Map BFL status to a simpler format
    switch (status.status) {
      case 'Ready':
        return NextResponse.json({
          status: 'completed',
          imageUrl: status.result?.sample,
        });

      case 'Error':
        return NextResponse.json({
          status: 'error',
          error: 'Image generation failed',
        });

      case 'Request Moderated':
      case 'Content Moderated':
        return NextResponse.json({
          status: 'error',
          error: 'Content was moderated by safety filters',
        });

      case 'Task not found':
        return NextResponse.json({
          status: 'error',
          error: 'Task not found',
        });

      case 'Pending':
      default:
        return NextResponse.json({
          status: 'pending',
        });
    }
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    );
  }
}
