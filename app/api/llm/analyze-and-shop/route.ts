import { NextRequest, NextResponse } from 'next/server';

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

/**
 * Proxy endpoint to Python LLM analyze-and-shop service.
 * 
 * This calls the Python FastAPI service at /analyze-and-shop
 * which:
 * 1. Analyzes furniture in the image using Claude Vision
 * 2. Searches for similar products online with prices
 * 3. Returns combined results with total cost
 * 
 * Input: image file (FormData)
 * Output: {
 *   status: "success" | "error",
 *   object_names: string[],
 *   total_price: string,
 *   objects: Array<{
 *     name: string,
 *     category: string,
 *     primary_color: string,
 *     style_tags: string[],
 *     material_tags: string[],
 *     description: string,
 *     product: {
 *       title: string,
 *       link: string,
 *       price: string,
 *       source: string,
 *       thumbnail?: string
 *     } | null
 *   }>,
 *   overall_style: string,
 *   color_palette: Array<{ color: string, name: string }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const imageUrl = formData.get('imageUrl') as string | null;

    if (!imageFile && !imageUrl) {
      return NextResponse.json(
        { error: 'Image file or imageUrl is required' },
        { status: 400 }
      );
    }

    let pythonFormData: FormData;

    if (imageFile) {
      // Convert File to Buffer for Python service
      const imageBuffer = await imageFile.arrayBuffer();
      const imageBlob = new Blob([imageBuffer], { type: imageFile.type });

      pythonFormData = new FormData();
      pythonFormData.append('image', imageBlob, imageFile.name);
    } else if (imageUrl) {
      // Fetch image from URL and forward to Python service
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch image from URL' },
          { status: 400 }
        );
      }
      
      const imageBlob = await imageResponse.blob();
      const fileName = imageUrl.split('/').pop() || 'image.jpg';
      
      pythonFormData = new FormData();
      pythonFormData.append('image', imageBlob, fileName);
    } else {
      return NextResponse.json(
        { error: 'No valid image source provided' },
        { status: 400 }
      );
    }

    // Forward to Python LLM service
    const response = await fetch(`${LLM_SERVICE_URL}/analyze-and-shop`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python LLM service error:', errorText);
      return NextResponse.json(
        { error: 'Analyze and shop failed', details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calling Python LLM service:', error);
    return NextResponse.json(
      { error: 'Failed to analyze and shop', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
