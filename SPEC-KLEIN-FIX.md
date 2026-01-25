# Klein Parser & Task Builder Fix Spec

## Problem Statement

The image edit flow crashes with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` at `lib/klein/parser.ts:111` when the user attempts to edit room images.

### Root Causes Identified

1. **Parser fallback returns malformed data** - The catch block (line 137-145) returns `intent: 'edit_objects'` without an `edits` array
2. **Missing null checks** - Line 111 assumes `edit.target` always exists
3. **Schema mismatch** - Database stores `name`, parser expects `label` on DetectedObject
4. **Placeholder object data** - `scan_image_items` returns generic labels ("Furniture") instead of specific ones ("Blue Velvet Sofa")
5. **Task builder fails silently** - Returns generic error "No valid tasks generated"

---

## Action Plan

### Phase 1: Defensive Fixes (Immediate Crash Prevention)

#### 1.1 Add null checks in parser.ts

**File:** `lib/klein/parser.ts`

```typescript
// Line 109-114: Add defensive check for edit.target
if (parsed.intent === 'edit_objects' && parsed.edits) {
  const validEdits = parsed.edits.filter((edit) => {
    if (!edit || !edit.target) {
      console.warn('Skipping edit with missing target:', edit);
      return false;
    }
    const targetLower = edit.target.toLowerCase();
    return availableObjects.some((obj) => {
      const label = obj.label || obj.name || '';
      return label.toLowerCase() === targetLower;
    });
  });
  parsed.edits = validEdits.length > 0 ? validEdits : undefined;
}
```

#### 1.2 Fix fallback in catch block

**File:** `lib/klein/parser.ts`

```typescript
// Line 135-146: Return error state instead of malformed edit
} catch (error) {
  console.error('Parser error:', error);
  console.error('Input text:', userText);
  console.error('Available objects:', availableObjects);

  // Return a proper error state instead of invalid edit_objects
  throw new Error(
    `Failed to parse instruction: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}
```

#### 1.3 Add label/name compatibility in types

**File:** `lib/klein/types.ts`

```typescript
export interface DetectedObject {
  id: string;
  label?: string;  // Primary field
  name?: string;   // Fallback for backwards compatibility
  category: string;
  bbox?: [number, number, number, number];
}
```

---

### Phase 2: Upstream Data Quality Fixes

#### 2.1 Improve scan_image_items tool output

**File:** `app/api/chat/route.ts` (or wherever tools are defined)

The `scan_image_items` tool should return descriptive labels with bounding boxes:

```typescript
// Expected output format
{
  objects: [
    {
      id: "obj_1",
      label: "Blue Velvet Sofa",      // Specific, descriptive
      category: "furniture",
      bbox: [0.1, 0.3, 0.5, 0.7]      // Normalized [x1, y1, x2, y2]
    },
    {
      id: "obj_2",
      label: "Brass Floor Lamp",
      category: "lighting",
      bbox: [0.7, 0.2, 0.85, 0.9]
    }
  ]
}
```

#### 2.2 Update database schema for detected_items

**File:** Database migration or `room_images` table

Ensure `detected_items` column stores proper object data:
- `label` field with descriptive names
- `bbox` field with normalized coordinates
- `category` for grouping

---

### Phase 3: Hybrid Edit Strategy

#### 3.1 Route decision logic

**File:** `lib/klein/task-builder.ts`

```typescript
export async function buildKleinTasks(
  instruction: ParsedInstruction,
  previousImage: RoomImage | null
): Promise<KleinTask[]> {

  // DECISION: Object-specific edit vs whole-room style change
  if (instruction.intent === 'edit_objects' && instruction.edits && previousImage) {
    const hasValidBbox = instruction.edits.every(edit => {
      const obj = previousImage.objects.find(o =>
        (o.label || o.name)?.toLowerCase() === edit.target.toLowerCase()
      );
      return obj?.bbox && obj.bbox.length === 4;
    });

    if (hasValidBbox) {
      // Use mask-based inpainting for precise object edits
      return buildMaskInpaintingTasks(instruction, previousImage);
    } else {
      // Fallback to seedImage-based editing (Nano Banana 2)
      return buildSeedImageTasks(instruction, previousImage);
    }
  }

  // Full room generation
  return buildGenerationTasks(instruction);
}
```

#### 3.2 seedImage task builder

```typescript
async function buildSeedImageTasks(
  instruction: ParsedInstruction,
  previousImage: RoomImage
): Promise<KleinTask[]> {
  const editPrompt = instruction.edits
    ?.map(e => `${e.target}: ${Object.values(e.attributes).filter(Boolean).join(', ')}`)
    .join('; ') || '';

  return [{
    taskType: 'imageEdit',
    model: 'google:4@2',  // Nano Banana 2
    seedImage: previousImage.imageUrl,
    prompt: editPrompt,
    strength: 0.3,  // Conservative for structure preservation
  }];
}
```

---

### Phase 4: Error Handling & UX

#### 4.1 User-friendly error messages

**File:** `app/api/chat/route.ts`

```typescript
try {
  const tasks = await buildKleinTasks(parsed, previousImage);
  // ... execute tasks
} catch (error) {
  console.error('Klein generation error:', {
    error,
    instruction: parsed,
    previousImage: previousImage?.imageUrl,
    availableObjects,
  });

  // User-friendly message
  const userMessage = getErrorMessage(error);
  return new Response(JSON.stringify({
    error: userMessage,
    hint: 'Try clicking on a specific object in the image before describing your changes.'
  }), { status: 400 });
}

function getErrorMessage(error: Error): string {
  if (error.message.includes('no objects detected')) {
    return "I can't find any objects to edit in this image. Try generating a new room first.";
  }
  if (error.message.includes('Failed to parse')) {
    return "I couldn't understand that edit request. Could you try rephrasing?";
  }
  if (error.message.includes('exceeds 30% limit')) {
    return "That object is too large to edit safely. Try a smaller change.";
  }
  return "Something went wrong with the edit. Please try again.";
}
```

#### 4.2 Enhanced server-side logging

Add structured logging at key decision points:

```typescript
console.log('Klein parse result:', {
  intent: parsed.intent,
  editsCount: parsed.edits?.length ?? 0,
  editTargets: parsed.edits?.map(e => e.target),
  availableLabels: availableObjects.map(o => o.label || o.name),
  roomId: parsed.roomId,
});
```

---

## Testing Checklist

- [ ] Parser handles empty `edits` array without crashing
- [ ] Parser handles edits with undefined `target` gracefully
- [ ] Parser matches both `label` and `name` fields on objects
- [ ] Task builder falls back to seedImage when bbox missing
- [ ] Error messages are user-friendly (no stack traces shown)
- [ ] Server logs contain full debug info
- [ ] Edit flow works with newly scanned objects
- [ ] Edit flow works with legacy "Furniture" placeholder objects

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/klein/parser.ts` | Null checks, label/name compat, better error handling |
| `lib/klein/task-builder.ts` | Hybrid routing, seedImage fallback |
| `lib/klein/types.ts` | Add optional `name` field to DetectedObject |
| `app/api/chat/route.ts` | User-friendly error responses, enhanced logging |
| `app/api/chat/tools.ts` (or similar) | Improve scan_image_items output format |
