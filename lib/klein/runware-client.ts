import type { KleinTask } from './types';

const RUNWARE_API_BASE = 'https://api.runware.ai/v1';

function getApiKey(): string {
  const apiKey = process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error('RUNWARE_API_KEY (or BFL_API_KEY) environment variable is not set');
  }
  return apiKey;
}

function transformTaskToRunware(task: KleinTask): any {
  const baseTask: any = {
    taskUUID: crypto.randomUUID(),
    positivePrompt: task.prompt,
    width: 1024,
    height: 1024,
    steps: 30,
    CFGScale: 7.5,
    model: 'runware:400@4',
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'jpg',
  };

  if (task.taskType === 'imageGeneration') {
    baseTask.taskType = 'imageInference';
  } else if (task.taskType === 'imageToImage') {
    // Image-to-image: Use seed image with strength
    baseTask.taskType = 'imageInference';
    if (task.image) {
      baseTask.seedImage = task.image;
      baseTask.strength = task.strength || 0.65;
    }
  } else if (task.taskType === 'imageInpainting') {
    // Inpainting: Use mask for targeted edits
    baseTask.taskType = 'imageInference';
    if (task.image) {
      baseTask.seedImage = task.image;
    }
    if (task.mask) {
      // Parse mask coordinates if JSON, otherwise use as-is
      try {
        const maskData = JSON.parse(task.mask);
        baseTask.maskImage = maskData;
      } catch {
        baseTask.maskImage = task.mask;
      }
    }
    baseTask.strength = 0.85; // Higher strength for inpainting
  }

  return baseTask;
}

export async function executeKleinTasks(tasks: KleinTask[]): Promise<string[]> {
  if (tasks.length === 0) {
    throw new Error('No tasks provided');
  }

  // Transform tasks to Runware format
  const runwareTasks = tasks.map(transformTaskToRunware);
  console.log('[Klein] Executing tasks:', JSON.stringify(runwareTasks.map(t => ({ type: t.taskType, hasImage: !!t.seedImage, strength: t.strength })), null, 2));

  const response = await fetch(RUNWARE_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(runwareTasks),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Runware API error: ${errorText}`);
  }

  const data: any = await response.json();

  const imageUrls: string[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      const result = item?.output?.[0] || item?.results?.[0] || item;
      const url = result?.url || result?.imageURL || result?.imageUrl;
      if (url && typeof url === 'string') {
        imageUrls.push(url);
      }
    }
  } else if (data.input) {
    for (const item of data.input) {
      const result = item?.output?.[0] || item?.results?.[0] || item;
      const url = result?.url || result?.imageURL || result?.imageUrl;
      if (url && typeof url === 'string') {
        imageUrls.push(url);
      }
    }
  } else {
    const result = data?.output?.[0] || data?.results?.[0] || data;
    const url = result?.url || result?.imageURL || result?.imageUrl;
    if (url && typeof url === 'string') {
      imageUrls.push(url);
    }
  }

  if (imageUrls.length === 0) {
    throw new Error('Runware API did not return any image URLs');
  }

  return imageUrls;
}

