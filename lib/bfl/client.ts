const BFL_API_BASE = 'https://api.bfl.ml/v1';

export interface GenerateImageParams {
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
}

export interface EditImageParams {
  image: string; // Base64 encoded image
  prompt: string;
  mask?: string; // Base64 encoded mask (optional for inpainting)
  strength?: number;
}

export interface BFLJobResponse {
  id: string;
}

export interface BFLStatusResponse {
  id: string;
  status: 'Task not found' | 'Pending' | 'Request Moderated' | 'Content Moderated' | 'Ready' | 'Error';
  result?: {
    sample: string; // URL to the generated image
  };
}

function getApiKey(): string {
  const apiKey = process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error('BFL_API_KEY environment variable is not set');
  }
  return apiKey;
}

export async function generateImage(params: GenerateImageParams): Promise<BFLJobResponse> {
  const response = await fetch(`${BFL_API_BASE}/flux-pro-1.1-ultra`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Key': getApiKey(),
    },
    body: JSON.stringify({
      prompt: params.prompt,
      width: params.width || 1024,
      height: params.height || 768,
      steps: params.steps || 40,
      guidance: params.guidance || 3.5,
      seed: params.seed,
      safety_tolerance: 2,
      output_format: 'jpeg',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BFL API error: ${error}`);
  }

  return response.json();
}

export async function editImage(params: EditImageParams): Promise<BFLJobResponse> {
  const response = await fetch(`${BFL_API_BASE}/flux-pro-1.1-fill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Key': getApiKey(),
    },
    body: JSON.stringify({
      image: params.image,
      prompt: params.prompt,
      mask: params.mask,
      strength: params.strength || 0.85,
      safety_tolerance: 2,
      output_format: 'jpeg',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BFL API error: ${error}`);
  }

  return response.json();
}

export async function checkStatus(jobId: string): Promise<BFLStatusResponse> {
  const response = await fetch(`${BFL_API_BASE}/get_result?id=${jobId}`, {
    method: 'GET',
    headers: {
      'X-Key': getApiKey(),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`BFL API error: ${error}`);
  }

  return response.json();
}
