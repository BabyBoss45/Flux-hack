import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { deleteColorFromPalette } from '@/lib/db/queries';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; colorId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { colorId } = await params;
    const colorIdNum = parseInt(colorId, 10);
    deleteColorFromPalette(colorIdNum);

    return Response.json({ success: true });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Failed to delete color',
      { status: 500 }
    );
  }
}
