import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;
  const filePath = path.join(process.cwd(), 'public', 'uploads', ...pathSegments);

  // Security: prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!normalizedPath.startsWith(uploadsDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const file = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };

  return new NextResponse(file, {
    headers: {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
