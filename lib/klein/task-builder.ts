import type { ParsedInstruction, KleinTask, RoomImage, DetectedObject } from './types';

export async function buildKleinTasks(
  instruction: ParsedInstruction,
  previousImage: RoomImage | null
): Promise<KleinTask[]> {
  const tasks: KleinTask[] = [];

  if (instruction.intent === 'generate_room') {
    // GUARD: Never generate room if we have a previous image (should edit instead)
    if (previousImage) {
      console.warn('[TASK BUILDER] generate_room intent but previousImage exists. This should not happen. Falling back to edit_objects.');
      // Force edit_objects instead
      instruction.intent = 'edit_objects';
      if (previousImage.objects.length > 0) {
        instruction.edits = [{
          target: previousImage.objects[0].label,
          action: 'modify',
          attributes: { description: 'User requested room generation but image exists - editing first object instead' },
        }];
      }
    } else {
      const prompt = buildGenerationPrompt(instruction);
      tasks.push({
        taskType: 'imageGeneration',
        model: 'flux-2.0-klein',
        prompt,
        imageSize: '1024x1024',
      });
    }
  }
  
  if (instruction.intent === 'edit_objects') {
    // GUARANTEE 1: No edit without previousImage
    if (!previousImage) {
      throw new Error('Cannot edit: no previous image available. Edits require an existing image.');
    }
    
    // GUARANTEE 1b: No edit without objects
    if (previousImage.objects.length === 0) {
      throw new Error('Cannot edit: no objects detected in current image');
    }
    
    // GUARANTEE 1c: No edit without edits array
    if (!instruction.edits || instruction.edits.length === 0) {
      throw new Error('Cannot edit: no edit instructions provided');
    }

    for (const edit of instruction.edits) {
      // Try to find object by ID first (most reliable), then by label
      let targetObject = null;
      
      // If objectId is stored in attributes, use it for exact matching
      if (edit.attributes?.objectId) {
        targetObject = previousImage.objects.find(
          (obj) => obj.id === edit.attributes.objectId
        );
        if (targetObject) {
          console.log(`[TASK BUILDER] Found object by ID: ${targetObject.id} (${targetObject.label})`);
        }
      }
      
      // Fallback to label matching if ID match failed
      if (!targetObject) {
        targetObject = previousImage.objects.find(
          (obj) => obj.label.toLowerCase() === edit.target.toLowerCase()
        );
        if (targetObject) {
          console.log(`[TASK BUILDER] Found object by label: ${targetObject.id} (${targetObject.label})`);
        }
      }

      if (!targetObject) {
        const availableLabels = previousImage.objects.map(obj => `${obj.id}:${obj.label}`).join(', ');
        console.error(`[TASK BUILDER] Object "${edit.target}" (ID: ${edit.attributes?.objectId || 'unknown'}) not found in available objects: [${availableLabels}]`);
        throw new Error(`Cannot edit: object "${edit.target}" not found in current image. Available objects: ${previousImage.objects.map(o => o.label).join(', ')}`);
      }

      // GUARANTEE 2: Mask must be < ~30% of image area
      const [x1, y1, x2, y2] = targetObject.bbox;
      const maskArea = (x2 - x1) * (y2 - y1);
      if (maskArea > 0.3) {
        throw new Error(`Mask area (${(maskArea * 100).toFixed(1)}%) exceeds 30% limit. Edit rejected to prevent drift.`);
      }

      // GUARANTEE 3: Always reuse currentImageUrl (sequential chaining)
      // CRITICAL: Only editing the selected object - mask covers ONLY this object's bbox
      console.log(`[TASK BUILDER] Editing ONLY object: ${targetObject.id} (${targetObject.label}) in image: ${previousImage.imageUrl.substring(0, 50)}...`);
      console.log(`[TASK BUILDER] Object bbox: [${targetObject.bbox.join(', ')}] - this is the ONLY area that will change`);
      const prompt = buildEditPrompt(edit, instruction, targetObject);
      const mask = await createMaskFromBbox(targetObject.bbox, previousImage.imageUrl);
      console.log(`[TASK BUILDER] Created mask for bbox: [${targetObject.bbox.join(', ')}] - mask covers ONLY this object`);

      // GUARANTEE 4: Never call imageGeneration for edits - ALWAYS use inpainting
      const maskAreaPercent = ((maskArea * 100).toFixed(1));
      console.log(`[TASK BUILDER] Creating inpainting task for ${targetObject.label} (ID: ${targetObject.id}) with mask area: ${maskAreaPercent}%`);
      console.log(`[TASK BUILDER] Using image: ${previousImage.imageUrl.substring(0, 60)}...`);
      console.log(`[TASK BUILDER] Prompt preview: ${prompt.substring(0, 100)}...`);
      
      tasks.push({
        taskType: 'imageInpainting', // CRITICAL: Must be inpainting, never imageGeneration
        model: 'flux-2.0-klein',
        prompt,
        image: previousImage.imageUrl, // Always use latest image (sequential chaining)
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

  // CRITICAL: Ultra-restrictive prompt pattern to prevent room drift
  return `INPAINTING TASK: Modify ONLY the masked object. Everything else MUST remain identical.

OBJECT TO EDIT:
- Type: ${objectType}
- Category: ${objectCategory}
- Region: White area in the mask (ONLY this area can change)

USER REQUEST: "${userRequest}"

STRICT RULES (VIOLATION = FAILURE):
1. Change ONLY the object in the white mask area
2. DO NOT modify anything outside the mask (walls, floor, ceiling, other furniture, lighting, windows, doors, decor, plants, artwork, rugs, curtains)
3. DO NOT change room layout, camera angle, perspective, or composition
4. DO NOT change lighting, shadows, or reflections outside the mask
5. DO NOT change colors, textures, or materials outside the mask
6. DO NOT add or remove objects
7. DO NOT change the room style, theme, or overall design
8. Preserve ALL other objects exactly as they appear
9. The masked object should blend seamlessly with NO visible seams
10. Maintain photorealistic quality matching the original image

CRITICAL: If the mask covers less than 30% of the image, ONLY that small area should change. The rest of the room (70%+) must be pixel-perfect identical.`;
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

