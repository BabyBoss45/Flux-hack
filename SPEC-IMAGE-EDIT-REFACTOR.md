# Image Edit Refactor Specification

## Overview

Refactor the image editing functionality to use **Nano Banana 2** (`google:4@2`) via Runware API with structure-preserving image-to-image transformation. This replaces the current placeholder implementation that generates new images instead of editing existing ones.

---

## Goals

- Enable true image-to-image editing using the source image as a seed
- Preserve room layout, furniture positions, and camera angles
- Allow changes to textures, colors, and materials via natural language prompts
- Use Google's Nano Banana 2 model for high-quality, structure-aware edits

---

## Technical Decisions

| Decision          | Choice                           | Rationale                                                    |
| ----------------- | -------------------------------- | ------------------------------------------------------------ |
| Model             | `google:4@2` (hardcoded)         | Nano Banana 2 for structure-preserving edits                 |
| Strength          | `0.3` (hardcoded)                | Conservative value preserves layout, allows material changes |
| Image Input       | Base64 only                      | Matches current API contract, simpler validation             |
| Output Dimensions | Match input (fallback: 1024x768) | Prevents distortion, maintains source aspect ratio           |
| Mask Support      | None                             | Per SPEC: "text-based edit instructions (no mask drawing)"   |
| Async Mode        | Keep param, ignore               | API compatibility; Runware is synchronous                    |

---

## API Changes

### `EditImageParams` Interface

**Before:**

```typescript
export interface EditImageParams {
  image: string; // Base64 encoded image
  prompt: string;
  mask?: string; // Base64 encoded mask (optional)
  strength?: number;
}
```

**After:**

```typescript
export interface EditImageParams {
  image: string; // Base64 encoded image (PNG, JPG, WEBP)
  prompt: string; // Natural language edit instruction
}
```

### Route Contract (`/api/images/edit`)

**Request:**

```json
{
  "image": "<base64-encoded-image>",
  "prompt": "Change the sofa to blue velvet",
  "async": false // Accepted but ignored; always synchronous
}
```

**Response (Success):**

```json
{
  "imageUrl": "https://..."
}
```

**Response (Async mode - for compatibility):**

```json
{
  "jobId": "<url-as-job-id>",
  "status": "pending"
}
```

---

## Implementation Details

### 1. Runware Request Body

```typescript
const body = {
  taskType: "imageInference",
  taskUUID: crypto.randomUUID(),
  positivePrompt: params.prompt,
  seedImage: params.image, // NEW: base64 source image
  model: "google:4@2", // Nano Banana 2
  strength: 0.3, // Structure-preserving
  width: extractedWidth || 1024, // Match input dimensions
  height: extractedHeight || 768,
  numberResults: 1,
  outputType: "URL",
  outputFormat: "jpg",
};
```

### 2. Dimension Extraction Utility

Create a utility function to extract dimensions from base64 image headers:

```typescript
// lib/bfl/image-utils.ts
export function extractImageDimensions(
  base64: string,
): { width: number; height: number } | null {
  // Decode image header to get dimensions
  // Support PNG, JPEG, WEBP formats
  // Return null if extraction fails
}
```

**Fallback behavior:** If dimension extraction fails, use default 1024x768.

### 3. `editImage` Function Changes

```typescript
export async function editImage(
  params: EditImageParams,
): Promise<BFLJobResponse> {
  // 1. Extract dimensions from input image
  const dimensions = extractImageDimensions(params.image) || {
    width: 1024,
    height: 768,
  };

  // 2. Build Runware request with seedImage
  const body = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    positivePrompt: params.prompt,
    seedImage: params.image,
    model: "google:4@2",
    strength: 0.3,
    width: dimensions.width,
    height: dimensions.height,
    numberResults: 1,
    outputType: "URL",
    outputFormat: "jpg",
  };

  // 3. Call Runware API
  const response = await fetch(RUNWARE_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify([body]),
  });

  // 4. Parse and return result (existing logic)
  // ...
}
```

---

## Files to Modify

| File                           | Changes                                           |
| ------------------------------ | ------------------------------------------------- |
| `lib/bfl/client.ts`            | Update `EditImageParams`, refactor `editImage()`  |
| `lib/bfl/image-utils.ts`       | **NEW**: Add `extractImageDimensions()` utility   |
| `app/api/images/edit/route.ts` | Remove `mask` and `strength` from request parsing |

---

## Supported Image Formats

- PNG
- JPEG/JPG
- WEBP

Input images must be base64-encoded. The API will accept images with or without the `data:image/...;base64,` prefix.

---

## Error Handling

| Scenario                   | Behavior                           |
| -------------------------- | ---------------------------------- |
| Invalid/corrupt image      | Return 400 with error message      |
| Dimension extraction fails | Use fallback dimensions (1024x768) |
| Runware API error          | Return 500 with error message      |
| Missing image parameter    | Return 400: "Image is required"    |
| Missing prompt parameter   | Return 400: "Prompt is required"   |

---

## Testing Considerations

\*\*\* Pass logs to see the original image is passed

1. **Structure preservation**: Verify edited images maintain room layout at strength 0.3
2. **Dimension matching**: Confirm output matches input dimensions
3. **Format support**: Test PNG, JPEG, WEBP inputs
4. **Fallback dimensions**: Test with corrupt image headers
5. **Prompt adherence**: Verify material/color changes apply correctly

---

## References

- [Runware Image-to-Image Docs](https://runware.ai/docs/en/image-inference/image-to-image)
- [Runware API Reference](https://runware.ai/docs/image-inference/api-reference)
- [Nano Banana Pro (Google)](https://blog.google/technology/ai/nano-banana-pro/)
- [Runware Models](https://runware.ai/models)
