# SPEC-FLUX-SKILLS: Image Generation & Editing

This document specifies the implementation details for the BFL Flux 2 image generation and editing tools used in the AI Interior Design Chat Interface.

---

## Overview

Two primary tools handle image operations:
- **`generate_room_image`** - Creates initial room visualizations from text prompts
- **`edit_room_image`** - Modifies existing images based on text instructions

Both tools integrate with the BFL Flux 2 API and are called by the AI agent via Vercel AI SDK tool calling.

---

## generate_room_image

### Purpose
Generate photorealistic interior room visualizations using BFL Flux 2 text-to-image API.

### Parameters

```typescript
interface GenerateRoomImageParams {
  room_id: string;              // Room to generate image for
  user_request: string;         // User's conversational request
  view_type?: 'main' | 'alternate_angle' | 'variation';  // Influences camera angle
}
```

### Returns

```typescript
interface GenerateRoomImageResult {
  image_id: string;
  image_url: string;
  prompt_used: string;          // Final prompt sent to BFL
  view_type: string;
  detected_items: DetectedItem[];  // Auto-scanned items
}

interface DetectedItem {
  id: string;
  name: string;
  category: 'furniture' | 'fixture' | 'decor' | 'architectural';
  position_hint?: string;       // e.g., "near window", "center of room"
}
```

### Prompt Construction

#### Always Include Room Geometry
Every prompt MUST include full room data regardless of user request:
- Room dimensions (length, width, area)
- Window positions and count
- Door positions and target rooms
- Adjacent rooms for context
- Existing fixtures

#### Structured Template Format
Use a consistent template with slots:

```
[STYLE] interior photograph of a [ROOM_TYPE], [LENGTH]m x [WIDTH]m ([AREA] sqm).
[WINDOW_DESC]. [DOOR_DESC].
Color palette: [COLORS]. Budget tier: [BUDGET].
[USER_REQUEST].
[VIEW_ANGLE].
[QUALITY_MODIFIERS].
```

Example filled template:
```
Modern interior photograph of a living room, 5.5m x 4.2m (23.1 sqm).
Two windows on the east wall providing natural light. Door on north wall leading to hallway.
Color palette: white, navy blue, coral accents. Budget tier: mid-range.
Minimalist furniture with a large sectional sofa and glass coffee table.
Eye-level view from the entrance.
Photorealistic, interior design magazine quality, natural lighting, 8K resolution.
```

#### View Type Camera Angles
The `view_type` parameter adds specific camera instructions:

| view_type | Prompt addition |
|-----------|-----------------|
| `main` | "Eye-level view from the entrance, showcasing the full room" |
| `alternate_angle` | "Corner perspective view, showing depth and adjacent walls" |
| `variation` | "Alternative styling variation, same camera angle as previous" |

### Resolution: Room-Adaptive

Aspect ratio matches actual room dimension ratio:

```typescript
function calculateAspectRatio(room: RoomGeometry): { width: number; height: number } {
  const ratio = room.length_m / room.width_m;

  // Map to BFL supported resolutions
  if (ratio >= 1.7) return { width: 1920, height: 1080 };  // 16:9 landscape
  if (ratio >= 1.3) return { width: 1536, height: 1024 };  // 3:2 landscape
  if (ratio >= 0.9) return { width: 1024, height: 1024 };  // 1:1 square
  if (ratio >= 0.7) return { width: 1024, height: 1536 };  // 3:2 portrait
  return { width: 1080, height: 1920 };                    // 16:9 portrait
}
```

### Prompt Enhancement

Auto-apply BFL best practices on every request:

```typescript
function enhancePrompt(basePrompt: string): string {
  const qualityModifiers = [
    "photorealistic",
    "interior design magazine quality",
    "professional photography",
    "natural lighting",
    "high resolution",
    "detailed textures"
  ];

  return `${basePrompt}. ${qualityModifiers.join(", ")}.`;
}
```

### Error Handling

Silent retry with prompt sanitization before surfacing errors:

```typescript
async function generateWithRetry(prompt: string, maxRetries = 1): Promise<Result> {
  try {
    return await bflApi.generate(prompt);
  } catch (error) {
    if (maxRetries > 0 && isPromptError(error)) {
      const sanitized = sanitizePrompt(prompt);
      return generateWithRetry(sanitized, maxRetries - 1);
    }
    throw error;
  }
}

function sanitizePrompt(prompt: string): string {
  // Remove potentially problematic terms
  // Simplify complex descriptions
  // Ensure prompt length within limits
}
```

### Item Scanning

Bundled with generation - automatically scan items after successful image creation:

```typescript
async function generateRoomImage(params: GenerateRoomImageParams): Promise<GenerateRoomImageResult> {
  const image = await generateImage(buildPrompt(params));
  const items = await scanImageItems(image.url);  // Always runs

  return {
    image_id: image.id,
    image_url: image.url,
    prompt_used: image.prompt,
    view_type: params.view_type || 'main',
    detected_items: items
  };
}
```

### Iteration Strategy

**First image for a room**: Use `generate_room_image`
**Subsequent changes**: Route to `edit_room_image` for consistency

The AI agent should track whether a room has an existing image and choose the appropriate tool.

---

## edit_room_image

### Purpose
Modify existing room images using BFL Flux 2 image editing API with text-based instructions (no mask drawing).

### Parameters

```typescript
interface EditRoomImageParams {
  image_url: string;            // Source image to edit
  room_id: string;              // For constraint validation
  target_item: string;          // Item to modify (e.g., "sofa", "lamp near window")
  edit_instruction: string;     // What to do (e.g., "change to blue velvet", "remove")
}
```

### Returns

```typescript
interface EditRoomImageResult {
  image_id: string;
  image_url: string;
  edit_applied: string;         // Description of edit performed
  detected_items: DetectedItem[];  // Full re-scan of items
}
```

### Ambiguity Handling

When `target_item` matches multiple items in the image, return an error requiring clarification:

```typescript
interface AmbiguityError {
  type: 'AMBIGUOUS_TARGET';
  message: string;
  matching_items: string[];     // Items that match the target
  suggestion: string;           // e.g., "Please specify: 'the chair near the window' or 'the chair by the door'"
}
```

The AI agent must clarify with the user before retrying.

### Image History

Keep both original and edited versions:

```typescript
async function editRoomImage(params: EditRoomImageParams): Promise<EditRoomImageResult> {
  const editedImage = await performEdit(params);

  // Save as new image, don't replace
  await db.roomImages.create({
    room_id: params.room_id,
    url: editedImage.url,
    prompt: `Edit: ${params.target_item} - ${params.edit_instruction}`,
    view_type: 'variation',
    created_at: new Date()
  });

  // Original image remains in database
  return editedImage;
}
```

### Edit Type Inference

Infer the edit type from the instruction text:

```typescript
type EditType = 'replace' | 'modify' | 'remove' | 'add';

function inferEditType(instruction: string): EditType {
  const lower = instruction.toLowerCase();

  if (lower.includes('remove') || lower.includes('delete')) {
    return 'remove';
  }
  if (lower.includes('add') || lower.includes('place') || lower.includes('put')) {
    return 'add';
  }
  if (lower.includes('change to') || lower.includes('replace with') || lower.includes('swap')) {
    return 'replace';
  }
  // Default: modify attributes (color, size, style)
  return 'modify';
}
```

### Item Re-scanning

Always perform full re-scan after any edit:

```typescript
async function editRoomImage(params: EditRoomImageParams): Promise<EditRoomImageResult> {
  const editedImage = await performEdit(params);

  // Full re-scan, not incremental update
  const items = await scanImageItems(editedImage.url);

  return {
    ...editedImage,
    detected_items: items
  };
}
```

### Constraint Validation

Block edits that conflict with room geometry data:

```typescript
interface ConstraintError {
  type: 'CONSTRAINT_VIOLATION';
  message: string;
  constraint: string;           // e.g., "North wall is interior (adjacent to hallway)"
  suggestion: string;           // e.g., "Windows can only be added to exterior walls (east wall)"
}

async function validateEdit(params: EditRoomImageParams, room: Room): Promise<void> {
  const editType = inferEditType(params.edit_instruction);

  if (editType === 'add' && isArchitecturalElement(params.target_item)) {
    // Check if the requested location is valid
    const position = extractPosition(params.edit_instruction);

    if (params.target_item.includes('window')) {
      const wall = getWallFromPosition(position);
      if (isInteriorWall(wall, room)) {
        throw {
          type: 'CONSTRAINT_VIOLATION',
          message: `Cannot add window on ${wall} wall`,
          constraint: `${wall} wall is interior (adjacent to ${room.adjacent_rooms})`,
          suggestion: `Windows can be added to exterior walls only`
        };
      }
    }
  }
}
```

### Batch Edit Orchestration

Single edit per call; AI agent orchestrates complex requests:

```typescript
// Tool only handles single edits
async function editRoomImage(params: EditRoomImageParams): Promise<EditRoomImageResult>;

// AI agent breaks down complex requests:
// User: "change the sofa to blue and add a plant"
// AI calls:
//   1. editRoomImage({ target_item: "sofa", edit_instruction: "change to blue" })
//   2. editRoomImage({ target_item: "plant", edit_instruction: "add near the sofa" })
```

---

## Shared: BFL API Integration

### Async Pattern

Both tools follow the BFL async job pattern:

```typescript
async function callBflApi(endpoint: string, params: object): Promise<BflResult> {
  // 1. Submit job
  const { job_id } = await fetch(`${BFL_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${BFL_API_KEY}` },
    body: JSON.stringify(params)
  }).then(r => r.json());

  // 2. Poll for completion
  let status = 'pending';
  while (status === 'pending' || status === 'processing') {
    await sleep(2500);  // Poll every 2.5 seconds
    const result = await fetch(`${BFL_BASE_URL}/status/${job_id}`).then(r => r.json());
    status = result.status;

    if (status === 'completed') {
      return result;
    }
    if (status === 'failed') {
      throw new BflError(result.error);
    }
  }
}
```

### API Endpoints

| Operation | Endpoint |
|-----------|----------|
| Text-to-Image | `POST /v1/flux2/text-to-image` |
| Image Edit | `POST /v1/flux2/edit` |
| Job Status | `GET /status/{job_id}` |

---

## Tool Interaction Flow

```
User: "Design my living room with a modern style"
                    ↓
AI Agent: Calls generate_room_image(room_id, user_request, view_type='main')
                    ↓
Tool: Builds structured prompt with room geometry + preferences
                    ↓
Tool: Applies BFL prompt enhancements
                    ↓
Tool: Calls BFL text-to-image API, polls for completion
                    ↓
Tool: Auto-scans generated image for items
                    ↓
Tool: Returns image_url + detected_items
                    ↓
AI Agent: Displays image and items to user
                    ↓
User: "Change the sofa to blue velvet"
                    ↓
AI Agent: Calls edit_room_image(image_url, room_id, "sofa", "change to blue velvet")
                    ↓
Tool: Infers edit_type='modify' from instruction
                    ↓
Tool: Validates against room constraints (passes)
                    ↓
Tool: Calls BFL image edit API
                    ↓
Tool: Saves new image (keeps original)
                    ↓
Tool: Full re-scan of items
                    ↓
Tool: Returns new image_url + updated items
```

---

## Summary Table

| Aspect | generate_room_image | edit_room_image |
|--------|---------------------|-----------------|
| Input | room_id, user_request, view_type | image_url, room_id, target_item, edit_instruction |
| Geometry | Always included in prompt | Used for constraint validation |
| Prompt format | Structured template | Inferred edit type |
| Resolution | Room-adaptive aspect ratio | Matches source image |
| Enhancement | Auto-apply always | N/A |
| Error handling | Silent retry with sanitization | Return error for ambiguity |
| Item scanning | Bundled (always) | Full re-scan (always) |
| Image storage | Creates new entry | Keeps both old and new |
| Constraint checking | N/A | Block violations with explanation |
