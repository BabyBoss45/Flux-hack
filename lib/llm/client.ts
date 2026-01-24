// LLM Floor Plan Analysis Service Client

const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:8000';

export interface LLMRoom {
  name: string;
  type: string;
  dimensions: {
    length_m: number;
    width_m: number;
    height_m: number;
    area_sqm: number;
    length_ft: number;
    width_ft: number;
    height_ft: number;
    area_sqft: number;
  };
  doors: Array<{
    location: string;
    type: string;
    width_m: number;
    width_ft: number;
  }>;
  windows: Array<{
    location: string;
    type: string;
    width_m: number;
    height_m: number;
    width_ft: number;
    height_ft: number;
  }>;
  fixtures: Array<{
    name: string;
    location: string;
    type: string;
  }>;
  adjacent_rooms: string[];
}

export interface LLMAnalysisResult {
  rooms: LLMRoom[];
  annotated_image_base64: string;
  room_count: number;
  total_area_sqm: number;
  total_area_sqft: number;
}

export interface HealthCheckResult {
  reachable: boolean;
  error?: string;
}

/**
 * Analyze a floor plan using the LLM service
 * @param buffer - Image buffer
 * @param filename - Original filename
 * @param context - Optional context string for analysis
 * @returns Analysis result with rooms and annotated image
 */
export async function analyzeFloorPlan(
  buffer: Buffer,
  filename: string,
  context?: string
): Promise<LLMAnalysisResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    // Detect content type from filename extension
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    };
    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

    // Create FormData
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
    formData.append('image', blob, filename);
    if (context) {
      formData.append('context', context);
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`[llm-client] POST /analyze - sending image: ${filename} (${fileSizeMB}MB), context: ${context || 'none'}`);
    const requestStartTime = Date.now();

    const response = await fetch(`${LLM_SERVICE_URL}/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM service returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const requestTime = Date.now() - requestStartTime;
    console.log(`[llm-client] Response received: ${result.room_count} rooms detected, ${result.total_area_sqft} sqft, took ${requestTime}ms`);
    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[llm-client] Request failed: ${error.message}`);
      if (error.name === 'AbortError') {
        throw new Error('LLM analysis timed out after 60 seconds');
      }
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the LLM service is reachable
 * @returns Health check result
 */
export async function healthCheck(): Promise<HealthCheckResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

  try {
    const response = await fetch(`${LLM_SERVICE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        reachable: false,
        error: `Service returned status ${response.status}`,
      };
    }

    return { reachable: true };
  } catch (error) {
    if (error instanceof Error) {
      return {
        reachable: false,
        error: error.name === 'AbortError' ? 'Health check timed out' : error.message,
      };
    }
    return {
      reachable: false,
      error: 'Unknown error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
