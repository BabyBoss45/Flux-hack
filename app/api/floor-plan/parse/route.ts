import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  return NextResponse.json(
    {
      error: 'ENDPOINT_DEPRECATED',
      message: 'This endpoint is deprecated. Please use POST /api/floor-plan/upload instead.',
    },
    { status: 410 } // 410 Gone
  );
}
