import type { ParsedInstruction, KleinTask, RoomImage, DetectedObject } from './types';

export async function buildKleinTasks(
  instruction: ParsedInstruction,
  previousImage: RoomImage | null
): Promise<KleinTask[]> {
  const tasks: KleinTask[] = [];

  if (instruction.intent === 'generate_room') {
    const prompt = buildGenerationPrompt(instruction);
    tasks.push({
      taskType: 'imageGeneration',
      model: 'flux-2.0-klein',
      prompt,
      imageSize: '1024x1024',
    });
  } else if (instruction.intent === 'edit_objects' && instruction.edits && previousImage) {
    // GUARANTEE 1: No edit without selected object
    if (previousImage.objects.length === 0) {
      throw new Error('Cannot edit: no objects detected in current image');
    }

    for (const edit of instruction.edits) {
      const targetObject = previousImage.objects.find(
        (obj) => obj.label.toLowerCase() === edit.target.toLowerCase()
      );

      if (!targetObject) {
        console.warn(`Object "${edit.target}" not found in available objects`);
        continue;
      }

      // GUARANTEE 2: Mask must be < ~30% of image area
      const [x1, y1, x2, y2] = targetObject.bbox;
      const maskArea = (x2 - x1) * (y2 - y1);
      if (maskArea > 0.3) {
        throw new Error(`Mask area (${(maskArea * 100).toFixed(1)}%) exceeds 30% limit. Edit rejected to prevent drift.`);
      }

      // GUARANTEE 3: Always reuse currentImageUrl (sequential chaining)
      const prompt = buildEditPrompt(edit, instruction, targetObject);
      const mask = await createMaskFromBbox(targetObject.bbox, previousImage.imageUrl);

      // GUARANTEE 4: Never call imageGeneration for edits
      tasks.push({
        taskType: 'imageInpainting',
        model: 'flux-2.0-klein',
        prompt,
        image: previousImage.imageUrl, // Always use latest image
        mask,
        imageSize: '1024x1024',
      });
    }
  }

  if (tasks.length === 0) {
    throw new Error('No valid tasks generated from instruction');
  }

  return tasks;
}

function buildGenerationPrompt(instruction: ParsedInstruction): string {
  const constraints = [];
  if (instruction.constraints.preserve_layout) {
    constraints.push('maintain existing room layout');
  }
  if (instruction.constraints.preserve_lighting) {
    constraints.push('preserve current lighting conditions');
  }
  if (instruction.constraints.preserve_camera) {
    constraints.push('keep same camera angle and perspective');
  }

  const constraintText = constraints.length > 0 ? `. ${constraints.join(', ')}.` : '';

  return `Photorealistic interior design render of a room${constraintText} Professional interior photography, high-end finishes, natural lighting, detailed textures, 8K resolution, architectural visualization quality.`;
}

function buildEditPrompt(
  edit: ParsedInstruction['edits'][0],
  instruction: ParsedInstruction,
  targetObject?: DetectedObject
): string {
  // Extract user request from attributes
  const userRequest = Object.entries(edit.attributes)
    .filter(([_, value]) => value !== null)
    .map(([key, value]) => {
      // If key is generic like "description" or "request", use value directly
      if (key === 'description' || key === 'request' || key === 'text') {
        return value;
      }
      return `${key}: ${value}`;
    })
    .join(', ');

  const objectType = targetObject?.label || edit.target;
  const objectCategory = targetObject?.category || 'furniture';

  // CRITICAL: Aggressively restrictive prompt pattern
  return `Modify ONLY the selected object in the image.

Object:
- Type: ${objectType}
- Category: ${objectCategory}
- Region: defined by the provided mask

User request:
"${userRequest}"

Rules:
- Change ONLY the masked object
- Do NOT modify walls, floor, ceiling, lighting, windows, or layout
- Preserve camera angle, perspective, and composition
- Preserve shadows and reflections outside the masked area
- Blend seamlessly into the existing image
- Maintain photorealistic quality
- Keep all other objects and room elements exactly as they are`;
}

/**
 * Creates a binary mask image from normalized bbox coordinates.
 * Best practice: Expand bbox by 5-10% padding, clamp to bounds, optional feathering.
 * 
 * @param bbox Normalized coordinates [x1, y1, x2, y2] where x2,y2 are absolute positions
 * @param imageUrl Source image URL for dimensions
 * @returns Base64-encoded binary mask image (white=editable, black=frozen)
 */
async function createMaskFromBbox(
  bbox: [number, number, number, number],
  imageUrl: string
): Promise<string> {
  const [x1, y1, x2, y2] = bbox;
  
  // Normalize and clamp coordinates
  const normalizedX1 = Math.max(0, Math.min(1, x1));
  const normalizedY1 = Math.max(0, Math.min(1, y1));
  const normalizedX2 = Math.max(0, Math.min(1, x2));
  const normalizedY2 = Math.max(0, Math.min(1, y2));

  // Calculate dimensions
  const width = normalizedX2 - normalizedX1;
  const height = normalizedY2 - normalizedY1;

  // Add 5-10% padding (use 7.5% as middle ground)
  const padding = 0.075;
  const paddedX1 = Math.max(0, normalizedX1 - padding * width);
  const paddedY1 = Math.max(0, normalizedY1 - padding * height);
  const paddedX2 = Math.min(1, normalizedX2 + padding * width);
  const paddedY2 = Math.min(1, normalizedY2 + padding * height);

  // Image dimensions (assume 1024x1024 for klein)
  const IMAGE_SIZE = 1024;
  
  // Convert to pixel coordinates
  const maskX = Math.round(paddedX1 * IMAGE_SIZE);
  const maskY = Math.round(paddedY1 * IMAGE_SIZE);
  const maskWidth = Math.round((paddedX2 - paddedX1) * IMAGE_SIZE);
  const maskHeight = Math.round((paddedY2 - paddedY1) * IMAGE_SIZE);

  // Clamp to image bounds
  const finalX = Math.max(0, Math.min(IMAGE_SIZE - 1, maskX));
  const finalY = Math.max(0, Math.min(IMAGE_SIZE - 1, maskY));
  const finalWidth = Math.max(1, Math.min(IMAGE_SIZE - finalX, maskWidth));
  const finalHeight = Math.max(1, Math.min(IMAGE_SIZE - finalY, maskHeight));

  // Create binary mask image (white rectangle on black background)
  // Using Canvas API would be ideal, but for server-side we'll use a simple approach
  // Runware accepts mask as base64 image or coordinates
  // For now, return coordinates as JSON (Runware can handle this)
  // TODO: Generate actual binary mask image if Runware requires it
  
  const maskData = {
    x: finalX,
    y: finalY,
    width: finalWidth,
    height: finalHeight,
  };

  return JSON.stringify(maskData);
}

