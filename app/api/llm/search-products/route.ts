import { NextRequest, NextResponse } from 'next/server';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

/**
 * Proxy endpoint to Python LLM product search service.
 * 
 * This calls the Python FastAPI service at /search-products
 * which finds similar furniture items online.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { furniture } = body;

    if (!furniture) {
      return NextResponse.json(
        { error: 'Furniture object is required' },
        { status: 400 }
      );
    }

    // Forward to Python LLM service
    const response = await fetch(`${LLM_SERVICE_URL}/search-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ furniture }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python LLM service error:', errorText);
      return NextResponse.json(
        { error: 'Product search failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling Python LLM service:', error);
    return NextResponse.json(
      { error: 'Failed to search products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

