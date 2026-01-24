import type { KleinTask, RunwareGeneratePayload } from './types';

const RUNWARE_API_BASE = 'https://api.runware.ai/v1/generate';

function getApiKey(): string {
  const apiKey = process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error('RUNWARE_API_KEY (or BFL_API_KEY) environment variable is not set');
  }
  return apiKey;
}

export async function executeKleinTasks(tasks: KleinTask[]): Promise<string[]> {
  if (tasks.length === 0) {
    throw new Error('No tasks provided');
  }

  const payload: RunwareGeneratePayload = {
    input: tasks,
  };

  const response = await fetch(RUNWARE_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(payload),
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

