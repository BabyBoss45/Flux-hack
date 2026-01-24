import { checkStatus, type BFLStatusResponse } from './client';

const POLL_INTERVAL_MS = 2500; // 2.5 seconds
const POLL_TIMEOUT_MS = 150000; // 2.5 minutes

export interface PollResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export async function pollForResult(jobId: string): Promise<PollResult> {
  // If the "job id" is already a URL (our Runware integration returns URLs directly),
  // we can short-circuit and return immediately.
  if (jobId.startsWith('http://') || jobId.startsWith('https://')) {
    return { success: true, imageUrl: jobId };
  }

  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    try {
      const status = await checkStatus(jobId);

      switch (status.status) {
        case 'Ready':
          if (status.result?.sample) {
            return { success: true, imageUrl: status.result.sample };
          }
          return { success: false, error: 'Image ready but no URL provided' };

        case 'Error':
          return { success: false, error: 'Image generation failed' };

        case 'Request Moderated':
        case 'Content Moderated':
          return { success: false, error: 'Content was moderated by safety filters' };

        case 'Task not found':
          return { success: false, error: 'Task not found' };

        case 'Pending':
          // Continue polling
          await sleep(POLL_INTERVAL_MS);
          break;

        default:
          // Unknown status, continue polling
          await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Continue polling on network errors
      await sleep(POLL_INTERVAL_MS);
    }
  }

  return { success: false, error: 'Timeout waiting for image generation' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Non-blocking version that returns status without waiting
export async function checkJobStatus(jobId: string): Promise<BFLStatusResponse | null> {
  try {
    return await checkStatus(jobId);
  } catch (error) {
    console.error('Status check error:', error);
    return null;
  }
}
