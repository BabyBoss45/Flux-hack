import type { DetectedObject } from './types';

/**
 * Enhanced object detection that combines:
 * 1. Bbox detection (from object-detection.ts) - provides location
 * 2. Furniture analysis (from Python LLM service) - provides colors, styles, materials
 * 
 * This merges the two sources of data to create rich object descriptions.
 */

export interface FurnitureAnalysisResult {
  status: 'success' | 'error';
  objects: Array<{
    name: string;
    category: string;
    primary_color?: string;
    style_tags?: string[];
    material_tags?: string[];
    description?: string;
  }>;
  overall_style?: string;
  color_palette?: Array<{ color: string; name: string }>;
}

/**
 * Merge bbox-detected objects with furniture analysis results.
 * 
 * Matches objects by name/label similarity and enriches them with:
 * - Colors
 * - Style tags
 * - Material tags
 * - Product recommendations
 */
export function mergeFurnitureAnalysis(
  detectedObjects: DetectedObject[],
  furnitureAnalysis: FurnitureAnalysisResult
): DetectedObject[] {
  if (furnitureAnalysis.status !== 'success' || !furnitureAnalysis.objects) {
    return detectedObjects; // Return original if analysis failed
  }

  const enrichedObjects = detectedObjects.map((detected) => {
    // Try to find matching furniture analysis object
    const match = findBestMatch(detected.label, furnitureAnalysis.objects);

    if (match) {
      return {
        ...detected,
        primary_color: match.primary_color,
        style_tags: match.style_tags,
        material_tags: match.material_tags,
        description: match.description,
      };
    }

    return detected; // Return original if no match found
  });

  return enrichedObjects;
}

/**
 * Find the best matching furniture object by name similarity.
 */
function findBestMatch(
  detectedLabel: string,
  furnitureObjects: FurnitureAnalysisResult['objects']
): FurnitureAnalysisResult['objects'][0] | null {
  const normalizedLabel = detectedLabel.toLowerCase().trim();

  // Exact match first
  const exactMatch = furnitureObjects.find(
    (obj) => obj.name.toLowerCase().trim() === normalizedLabel
  );
  if (exactMatch) return exactMatch;

  // Partial match (e.g., "sofa" matches "Three-Seat Sofa")
  const partialMatch = furnitureObjects.find((obj) => {
    const normalizedName = obj.name.toLowerCase().trim();
    return (
      normalizedName.includes(normalizedLabel) ||
      normalizedLabel.includes(normalizedName.split(' ')[0]) // Match first word
    );
  });
  if (partialMatch) return partialMatch;

  // Category match (e.g., "sofa" matches "couch")
  const categorySynonyms: Record<string, string[]> = {
    sofa: ['couch', 'sofa', 'settee'],
    table: ['table', 'desk', 'surface'],
    chair: ['chair', 'seat', 'stool'],
    bed: ['bed', 'mattress'],
  };

  for (const [category, synonyms] of Object.entries(categorySynonyms)) {
    if (synonyms.some((syn) => normalizedLabel.includes(syn))) {
      const categoryMatch = furnitureObjects.find((obj) =>
        synonyms.some((syn) => obj.name.toLowerCase().includes(syn))
      );
      if (categoryMatch) return categoryMatch;
    }
  }

  return null;
}

/**
 * Call Python LLM service to analyze furniture in an image.
 */
export async function analyzeFurnitureWithLLM(
  imageUrl: string
): Promise<FurnitureAnalysisResult | null> {
  try {
    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image for furniture analysis');
    }

    const imageBlob = await imageResponse.blob();
    const imageFile = new File([imageBlob], 'room-image.jpg', { type: imageBlob.type });

    // Call Next.js API route (which proxies to Python service)
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await fetch('/api/llm/analyze-furniture', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('Furniture analysis failed:', await response.text());
      return null;
    }

    const result = await response.json();
    return result as FurnitureAnalysisResult;
  } catch (error) {
    console.error('Error analyzing furniture with LLM:', error);
    return null;
  }
}

/**
 * Search for products matching a furniture object.
 */
export async function searchProductsForObject(
  furnitureObject: DetectedObject
): Promise<DetectedObject['product_recommendations']> {
  try {
    const response = await fetch('/api/llm/search-products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        furniture: {
          name: furnitureObject.label,
          category: furnitureObject.category,
          primary_color: furnitureObject.primary_color,
          style_tags: furnitureObject.style_tags,
          material_tags: furnitureObject.material_tags,
          description: furnitureObject.description,
        },
      }),
    });

    if (!response.ok) {
      console.error('Product search failed:', await response.text());
      return undefined;
    }

    const result = await response.json();
    return result.recommendations || undefined;
  } catch (error) {
    console.error('Error searching products:', error);
    return undefined;
  }
}

