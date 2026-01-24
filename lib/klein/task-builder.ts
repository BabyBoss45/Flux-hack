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
    for (const edit of instruction.edits) {
      const targetObject = previousImage.objects.find(
        (obj) => obj.label.toLowerCase() === edit.target.toLowerCase()
      );

      if (!targetObject) {
        continue;
      }

      const prompt = buildEditPrompt(edit, instruction);
      const mask = await createMaskFromBbox(targetObject.bbox, previousImage.imageUrl);

      tasks.push({
        taskType: 'imageInpainting',
        model: 'flux-2.0-klein',
        prompt,
        image: previousImage.imageUrl,
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
  instruction: ParsedInstruction
): string {
  const attributes = Object.entries(edit.attributes)
    .filter(([_, value]) => value !== null)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');

  const constraints = [];
  if (instruction.constraints.preserve_layout) {
    constraints.push('maintain room layout');
  }
  if (instruction.constraints.preserve_lighting) {
    constraints.push('preserve lighting');
  }
  if (instruction.constraints.preserve_camera) {
    constraints.push('keep camera angle');
  }

  const constraintText = constraints.length > 0 ? `. ${constraints.join(', ')}.` : '';

  if (edit.action === 'replace') {
    return `Replace ${edit.target} with ${attributes}${constraintText} Photorealistic quality, seamless integration with existing room design.`;
  } else {
    return `Modify ${edit.target}: ${attributes}${constraintText} Photorealistic quality, maintain consistency with existing room design.`;
  }
}

async function createMaskFromBbox(
  bbox: [number, number, number, number],
  imageUrl: string
): Promise<string> {
  const [x, y, width, height] = bbox;
  const imgX = Math.max(0, Math.min(1, x));
  const imgY = Math.max(0, Math.min(1, y));
  const imgWidth = Math.max(0, Math.min(1, width));
  const imgHeight = Math.max(0, Math.min(1, height));

  try {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const maskX = Math.round(imgX * 1024);
    const maskY = Math.round(imgY * 1024);
    const maskWidth = Math.round(imgWidth * 1024);
    const maskHeight = Math.round(imgHeight * 1024);

    const maskData = {
      x: maskX,
      y: maskY,
      width: maskWidth,
      height: maskHeight,
    };

    return JSON.stringify(maskData);
  } catch (error) {
    console.error('Error creating mask from bbox:', error);
    const maskX = Math.round(imgX * 1024);
    const maskY = Math.round(imgY * 1024);
    const maskWidth = Math.round(imgWidth * 1024);
    const maskHeight = Math.round(imgHeight * 1024);

    return JSON.stringify({
      x: maskX,
      y: maskY,
      width: maskWidth,
      height: maskHeight,
    });
  }
}

