import { NextResponse } from 'next/server';
import * as llmClient from '@/lib/llm/client';

export async function GET() {
  try {
    const health = await llmClient.healthCheck();

    return NextResponse.json({
      status: health.reachable ? 'healthy' : 'unhealthy',
      llm_service: health,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      llm_service: {
        reachable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
