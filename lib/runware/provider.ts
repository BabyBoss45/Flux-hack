import { createRunware } from '@runware/ai-sdk-provider';

/**
 * Get the API key for Runware from environment variables.
 * Falls back to BFL_API_KEY for backwards compatibility.
 */
export function getApiKey(): string {
  const apiKey = process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Missing API key. Set RUNWARE_API_KEY or BFL_API_KEY environment variable.'
    );
  }
  return apiKey;
}

/**
 * Create a Runware provider instance with the configured API key.
 */
export function createRunwareProvider() {
  return createRunware({
    apiKey: getApiKey(),
  });
}

/**
 * Runware model for standard image generation.
 * Uses 'runware:100@1' (FLUX.1 Schnell - ultra-fast 4-step generation).
 */
export function getRunwareModel() {
  const runware = createRunwareProvider();
  return runware.image('runware:100@1');
}

/**
 * Runware model for inpainting operations.
 * Uses 'google:4@2' (Nano Banana 2 Pro).
 */
export function getRunwareInpaintModel() {
  const runware = createRunwareProvider();
  return runware.image('google:4@2');
}

/**
 * Export a pre-configured model for convenience.
 */
export const runwareModel = (() => {
  try {
    return getRunwareModel();
  } catch {
    // Return null during build time when env vars aren't available
    return null;
  }
})();
