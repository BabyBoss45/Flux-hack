import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { DetectedObject, ObjectRecognitionResponse } from './types';
import { analyzeFurnitureWithLLM, mergeFurnitureAnalysis } from './furniture-enhancer';

const ObjectRecognitionSchema = z.object({
  objects: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      category: z.enum(['furniture', 'surface', 'lighting', 'architectural']),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    })
  ),
});

const OBJECT_RECOGNITION_PROMPT = `Analyze the provided interior image.

Identify the main editable objects in the room.

Rules:
- Only include large, user-editable objects
- Ignore small decor and accessories
- Focus on furniture and surfaces

For each object, return:
- object_id
- object_label (e.g. sofa, coffee table, rug, wall, floor)
- object_category (furniture | surface | lighting | architectural)
- approximate bounding box as normalized coordinates [x1, y1, x2, y2]

Return JSON only.`;

export async function detectObjects(
  imageUrl: string,
  options?: { enhanceWithLLM?: boolean }
): Promise<DetectedObject[] | null> {
  if (!imageUrl) {
    return null;
  }

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image for object recognition');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageDataUrl,
            },
            {
              type: 'text',
              text: OBJECT_RECOGNITION_PROMPT,
            },
          ],
        },
      ],
      schema: ObjectRecognitionSchema,
    });

    const response = object as ObjectRecognitionResponse;
    const detectedObjects = response.objects.map((obj) => ({
      id: obj.id,
      label: obj.label,
      category: obj.category,
      bbox: obj.bbox,
    }));

    // Optionally enhance with Python LLM furniture analysis
    if (options?.enhanceWithLLM && detectedObjects.length > 0) {
      try {
        const furnitureAnalysis = await analyzeFurnitureWithLLM(imageUrl);
        if (furnitureAnalysis) {
          return mergeFurnitureAnalysis(detectedObjects, furnitureAnalysis);
        }
      } catch (error) {
        console.error('Failed to enhance with LLM analysis:', error);
        // Continue with basic detection if enhancement fails
      }
    }
    
    // Return empty array only if detection succeeded but found no objects
    // Return null if detection failed
    return detectedObjects;
  } catch (error) {
    console.error('Object detection failed:', error);
    return null;
  }
}

