import { NextRequest, NextResponse } from 'next/server';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

/**
 * Proxy endpoint to Python LLM furniture analyzer service.
 * 
 * This calls the Python FastAPI service at /analyze-furniture
 * which uses Claude Vision to identify furniture with colors, styles, materials.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json(
        { error: 'Image file is required' },
        { status: 400 }
      );
    }

    // Convert File to Buffer for Python service
    const imageBuffer = await imageFile.arrayBuffer();
    const imageBlob = new Blob([imageBuffer], { type: imageFile.type });

    // Forward to Python LLM service
    const pythonFormData = new FormData();
    pythonFormData.append('image', imageBlob, imageFile.name);

    const response = await fetch(`${LLM_SERVICE_URL}/analyze-furniture`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python LLM service error:', errorText);
      return NextResponse.json(
        { error: 'Furniture analysis failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling Python LLM service:', error);
    return NextResponse.json(
      { error: 'Failed to analyze furniture', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

