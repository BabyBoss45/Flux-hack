import { extractImageDimensions } from './image-utils';

const RUNWARE_API_BASE = 'https://api.runware.ai/v1';

export interface GenerateImageParams {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  model?: string;
}

export interface EditImageParams {
  image: string; // Base64 encoded image (PNG, JPG, WEBP)
  prompt: string; // Natural language edit instruction
}

export interface BFLJobResponse {
  id: string;
}

export interface BFLStatusResponse {
  id: string;
  status:
    | 'Task not found'
    | 'Pending'
    | 'Request Moderated'
    | 'Content Moderated'
    | 'Ready'
    | 'Error';
  result?: {
    sample: string; // URL to the generated image
  };
}

function getApiKey(): string {
  // Prefer a dedicated Runware key but fall back to the existing BFL key
  const apiKey = process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RUNWARE_API_KEY (or BFL_API_KEY) environment variable is not set'
    );
  }
  return apiKey;
}

export async function generateImage(params: GenerateImageParams): Promise<BFLJobResponse> {
  // Runware's HTTP API is synchronous – it returns image URLs directly.
  // To keep the rest of the app unchanged, we treat the returned URL as the "job id".
  const body = {
    taskType: 'imageInference',
    taskUUID:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    positivePrompt: params.prompt,
    width: params.width || 1024,
    height: params.height || 768,
    // Map our generic parameters to Runware equivalents
    steps: params.steps || 30,
    CFGScale: params.guidance || 7.5,
    // Use explicit model or default to your chosen Runware AIR identifier
    model: params.model || 'runware:400@4',
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'jpg',
  };

  const response = await fetch(`${RUNWARE_API_BASE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    // Runware expects an array of task objects
    body: JSON.stringify([body]),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runware API error: ${error}`);
  }

  const data: any = await response.json();

  // Runware responses can be either:
  // - { data: [ { imageURL, ... } ], errors: [] }
  // - [ { tasks: [ { results: [ { url } ] } ] } ]
  // Normalize to a "first task/result" shape.
  const root = Array.isArray(data) ? data[0] : data;
  const firstContainer = root?.data?.[0] ?? root?.tasks?.[0] ?? root;
  const firstResult =
    firstContainer?.results?.[0] ?? firstContainer?.output?.[0] ?? firstContainer;

  const imageUrl =
    firstResult?.url ??
    firstResult?.imageURL ??
    firstResult?.imageUrl ??
    root?.imageURL;

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Runware API did not return an image URL');
  }

  // Return the URL as the "job id" so existing polling logic can treat it as done.
  return { id: imageUrl };
}

export async function editImage(params: EditImageParams): Promise<BFLJobResponse> {
  // Extract dimensions from input image, fallback to 1024x768
  const dimensions = extractImageDimensions(params.image) || {
    width: 1024,
    height: 768,
  };

  // Build Runware image-to-image request with seedImage for structure preservation
  const body = {
    taskType: 'imageInference',
    taskUUID:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    positivePrompt: params.prompt,
    seedImage: params.image, // Base64 source image for structure-preserving edit
    model: 'google:4@2', // Nano Banana 2 for structure-aware edits
    strength: 0.3, // Conservative value preserves layout, allows material changes
    width: dimensions.width,
    height: dimensions.height,
    numberResults: 1,
    outputType: 'URL',
    outputFormat: 'jpg',
  };

  const response = await fetch(`${RUNWARE_API_BASE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    // Runware expects an array of task objects
    body: JSON.stringify([body]),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Runware API error: ${error}`);
  }

  const data: any = await response.json();

  const root = Array.isArray(data) ? data[0] : data;
  const firstContainer = root?.data?.[0] ?? root?.tasks?.[0] ?? root;
  const firstResult =
    firstContainer?.results?.[0] ?? firstContainer?.output?.[0] ?? firstContainer;

  const imageUrl =
    firstResult?.url ??
    firstResult?.imageURL ??
    firstResult?.imageUrl ??
    root?.imageURL;

  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('Runware API did not return an image URL for edit');
  }

  return { id: imageUrl };
}

export async function checkStatus(jobId: string): Promise<BFLStatusResponse> {
  // With Runware's synchronous HTTP API we don't actually poll for status.
  // If the "job id" looks like a URL, treat it as already completed.
  if (jobId.startsWith('http://') || jobId.startsWith('https://')) {
    return {
      id: jobId,
      status: 'Ready',
      result: { sample: jobId },
    };
  }

  // Fallback – mark as not found.
  return {
    id: jobId,
    status: 'Task not found',
  };
}
