# Image Edit Redesign: React-Konva Canvas with Runware Inpainting

## Overview

This spec describes the redesign of the image editing system, replacing the Klein-based natural language edit flow with a visual canvas-based inpainting interface using React-Konva and Runware's inpainting API.

**Key Change**: Users draw masks directly on images to define edit regions, then provide a text prompt describing the desired change. This replaces the current system where users describe edits in chat and the system attempts to parse intent and generate masks from bounding boxes.

---

## Motivation

The current Klein system has limitations:

- Bbox-based masks are imprecise and limited to rectangular regions
- Natural language parsing introduces ambiguity
- Users lack direct control over which pixels are modified
- Complex edits require multiple chat exchanges for clarification

The canvas-based approach provides:

- Precise user control over edit regions via freehand drawing
- Visual feedback showing exactly what will change
- Simpler UX - draw and describe, no interpretation needed
- Industry-standard inpainting workflow

---

## Architecture Changes

### Components to Remove

| Component                | Location                                 | Reason                              |
| ------------------------ | ---------------------------------------- | ----------------------------------- |
| Klein parser             | `lib/klein/parser.ts`                    | No longer parsing NL edit intents   |
| Klein task builder       | `lib/klein/task-builder.ts`              | Masks are user-drawn, not generated |
| Klein types              | `lib/klein/types.ts`                     | Supporting types no longer needed   |
| Runware client           | `lib/klein/runware-client.ts`            | Replaced by Vercel AI SDK           |
| `edit_room_image` tool   | Chat agent tools                         | Edits happen in canvas, not chat    |
| Object detection overlay | `components/rooms/room-image-viewer.tsx` | Bboxes no longer used for masking   |
| Klein API route          | `app/api/klein/*`                        | Entire Klein subsystem removed      |

### Components to Add

| Component             | Location                              | Purpose                                |
| --------------------- | ------------------------------------- | -------------------------------------- |
| Canvas Editor         | `components/rooms/canvas-editor.tsx`  | React-Konva drawing surface            |
| Canvas Toolbar        | `components/rooms/canvas-toolbar.tsx` | Brush, eraser, zoom, undo controls     |
| Inpainting API route  | `app/api/images/edit/route.ts`        | New implementation using Vercel AI SDK |
| Runware AI SDK config | `lib/runware/provider.ts`             | Vercel AI SDK provider setup           |

### Components to Modify

| Component                          | Changes                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| `room-image-viewer.tsx`            | Replace image display with canvas editor, remove object detection |
| `app/api/images/generate/route.ts` | Migrate to Vercel AI SDK                                          |
| Chat agent tools                   | Remove `edit_room_image`, keep `generate_room_image`              |

---

## Canvas Editor Specification

### Display

- **Resolution**: 1920x1080 (matches image generation resolution)
- **Rendering**: Full resolution canvas with zoom/pan for navigation
- **Default view**: Canvas always visible when image exists, replaces image viewer
- **Layout**: Canvas in main area, thumbnail strip and info bar remain below
- **Empty state**: Show placeholder when no images generated yet, tools disabled

### Drawing Tools

#### Brush Tool

- **Purpose**: Draw mask regions (areas to be modified)
- **Visual**: Semi-transparent green (primary: #00ff9d;, ~50% opacity) while drawing
- **Export**: Converted to white (#FFFFFF) on black (#000000) background for API
- **Sizes**: Adjustable via slider or presets (Small: 10px, Medium: 30px, Large: 60px)
- **Behavior**: Freehand drawing, smooth curves via pointer tracking

#### Eraser Tool

- **Purpose**: Remove mask strokes
- **Visual**: Removes green overlay, reveals original image
- **Export**: Draws black on mask layer
- **Sizes**: Same options as brush

#### Clear Button

- **Purpose**: Reset all mask strokes instantly
- **Behavior**: Clears mask layer, does NOT affect undo history (clear is undoable)

### Navigation

#### Zoom

- **Mouse wheel**: Zoom in/out centered on cursor position
- **Toolbar buttons**: Zoom In (+), Zoom Out (-), Fit to View (100%)
- **Range**: 25% to 400%
- **Keyboard**: `+`/`-` for zoom, `0` for fit

#### Pan

- **Mouse drag**: When zoomed past viewport, drag to pan (middle mouse or spacebar+drag)
- **Touch**: Two-finger drag on touch devices

### History

- **Undo/Redo**: 20 action limit
- **Actions tracked**: Brush strokes, eraser strokes, clear
- **Controls**: Toolbar buttons + keyboard shortcuts (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`)
- **Clear behavior**: Clearing mask is one undoable action

### Toolbar Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Brush] [Eraser]  |  Size: [━━━●━━]  |  [Undo] [Redo] [Clear]  |  [Zoom -] [100%] [Zoom +] [Fit]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prompt Input Panel

Located below the canvas (above thumbnails):

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Describe what should appear in the masked area:                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  A modern velvet sofa in navy blue                                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                         [Generate Edit] │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Prompt field**: Multi-line text input for describing the edit
- **Generate button**: Disabled until mask has strokes
- **Loading state**: Show spinner during generation, disable all controls
- **Keyboard**: `Cmd/Ctrl+Enter` to submit

---

## Mask Export Process

1. **Capture strokes**: Get all Line shapes from the mask layer
2. **Create export canvas**: 1920x1080 off-screen canvas
3. **Fill background**: Solid black (#000000)
4. **Render strokes**: Draw all strokes in white (#FFFFFF)
5. **Export**: `canvas.toDataURL('image/png')`
6. **Result**: Base64-encoded PNG suitable for Runware maskImage parameter

```typescript
function exportMask(stage: Konva.Stage): string {
  const layer = stage.findOne("#mask-layer");
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1920;
  exportCanvas.height = 1080;
  const ctx = exportCanvas.getContext("2d")!;

  // Black background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, 1920, 1080);

  // White strokes
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Render each stroke
  for (const line of layer.find("Line")) {
    const points = line.points();
    ctx.lineWidth = line.strokeWidth();
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) {
      ctx.lineTo(points[i], points[i + 1]);
    }
    ctx.stroke();
  }

  return exportCanvas.toDataURL("image/png");
}
```

---

## API Integration

### Vercel AI SDK Setup

**New dependency**: `@runware/ai-sdk-provider`

```typescript
// lib/runware/provider.ts
import { runware } from "@runware/ai-sdk-provider";

export const runwareModel = runware.image("google:4@2"); // Nano Banana 2 Pro

export function getApiKey(): string {
  const key = process.env.RUNWARE_API_KEY;
  if (!key) throw new Error("RUNWARE_API_KEY not set");
  return key;
}
```

### Inpainting API Route

**Route**: `POST /api/images/edit`

**Request body**:

```typescript
interface InpaintRequest {
  seedImage: string; // URL of original image
  maskImage: string; // Base64 data URL of mask
  prompt: string; // Description of desired edit
  roomId: string; // For saving result
}
```

**Response**:

```typescript
interface InpaintResponse {
  imageUrl: string; // URL of generated image
  imageId: number; // Database ID of saved room_image
}
```

**Implementation**:

```typescript
// app/api/images/edit/route.ts
import { NextResponse } from "next/server";
import { experimental_generateImage as generateImage } from "ai";
import { runwareModel } from "@/lib/runware/provider";
import { getSession } from "@/lib/auth/mock-auth";
import { addRoomImage } from "@/lib/db/queries";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { seedImage, maskImage, prompt, roomId } = await request.json();

  if (!seedImage || !maskImage || !prompt || !roomId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const { image } = await generateImage({
      model: runwareModel,
      prompt,
      size: "1920x1080",
      providerOptions: {
        runware: {
          seedImage,
          maskImage,
          strength: 0.8,
          steps: 30,
        },
      },
    });

    // Save to database
    const roomImage = await addRoomImage(roomId, {
      url: image.url,
      prompt: `[Inpaint] ${prompt}`,
      view_type: "edit",
      detected_items: "[]",
    });

    return NextResponse.json({
      imageUrl: image.url,
      imageId: roomImage.id,
    });
  } catch (error) {
    console.error("Inpainting error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Inpainting failed" },
      { status: 500 },
    );
  }
}
```

### Generation Route Migration

Update `/api/images/generate` to also use Vercel AI SDK:

```typescript
// app/api/images/generate/route.ts
import { experimental_generateImage as generateImage } from "ai";
import { runwareModel } from "@/lib/runware/provider";

// ... same pattern, without seedImage/maskImage
```

---

## UI Component Changes

### Room Image Viewer Updates

Remove from `room-image-viewer.tsx`:

- `DetectedObject` interface
- Object detection parsing logic
- Object overlay rendering
- `onObjectSelect` prop
- `selectedObjectId` prop
- Object chips section

Add:

- Canvas editor integration
- Prompt input panel
- Loading states for inpainting

### Simplified Props

```typescript
interface RoomImageViewerProps {
  images: RoomImage[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onImageLoad?: () => void;
  roomId: string;
  onImageAdded?: (image: RoomImage) => void;
}
```

---

## Chat Agent Changes

### Tools to Keep

- `generate_room_image` - Initial generation via chat still supported
- `scan_image_items` - May be useful for product search
- `approve_room` - Room approval workflow unchanged
- `get_room_context` - Context retrieval unchanged

### Tools to Remove

- `edit_room_image` - All edits now happen in canvas

### System Prompt Update

Remove references to:

- "Edit existing room images to modify specific elements"
- Klein system
- Object selection for editing

Add:

- "For image edits, users can use the canvas editor to draw masks and specify changes"

---

## Database Schema

No schema changes required. The `room_images` table already supports:

- Multiple images per room (new edit results added as versions)
- `prompt` field (prefix with `[Inpaint]` for edit results)
- `view_type` field (use `'edit'` for inpainted images)

---

## State Management

### Canvas State (React useState)

```typescript
interface CanvasState {
  tool: "brush" | "eraser";
  brushSize: number;
  zoom: number;
  pan: { x: number; y: number };
  strokes: Stroke[];
  historyIndex: number;
  history: Stroke[][];
  isGenerating: boolean;
}

interface Stroke {
  id: string;
  tool: "brush" | "eraser";
  points: number[];
  strokeWidth: number;
}
```

### Actions

- `setTool(tool)` - Switch between brush/eraser
- `setBrushSize(size)` - Update stroke width
- `addStroke(stroke)` - Add stroke, push to history
- `undo()` - Decrement historyIndex, restore strokes
- `redo()` - Increment historyIndex, restore strokes
- `clear()` - Clear strokes, push empty state to history
- `setZoom(level)` - Update zoom
- `setPan(offset)` - Update pan offset

---

## Error Handling

| Error                | User Message                                                 | Recovery                           |
| -------------------- | ------------------------------------------------------------ | ---------------------------------- |
| Empty mask submitted | "Please draw on the image to mark the area you want to edit" | Keep prompt, focus canvas          |
| API timeout          | "The edit is taking longer than expected. Please try again." | Enable retry button                |
| API error            | "Edit failed: {message}"                                     | Keep mask and prompt, enable retry |
| Network error        | "Connection lost. Please check your internet and try again." | Show reconnect prompt              |

---

## Performance Considerations

- **Canvas resolution**: Full 1920x1080 may be slow on low-end devices
- **Stroke smoothing**: Limit point density during fast drawing
- **History limit**: 20 actions prevents memory bloat
- **Image loading**: Show skeleton while loading seed image into canvas

---

## Migration Plan

### Phase 1: Add New Components

1. Install `@runware/ai-sdk-provider` dependency
2. Create `lib/runware/provider.ts`
3. Create `canvas-editor.tsx` and `canvas-toolbar.tsx`
4. Update `/api/images/edit` route

### Phase 2: Update UI

1. Modify `room-image-viewer.tsx` to embed canvas
2. Remove object detection display
3. Add prompt input panel

### Phase 3: Clean Up

1. Delete `lib/klein/` directory
2. Remove `edit_room_image` from chat tools
3. Update chat system prompt
4. Update `/api/images/generate` to use Vercel AI SDK

### Phase 4: Testing

1. Test canvas drawing on various devices
2. Test mask export accuracy
3. Test inpainting API integration
4. Test undo/redo functionality

---

## Out of Scope

- Lasso/polygon selection tools (freehand brush only)
- Multiple mask layers
- Mask saving/loading
- Collaborative editing
- Mobile-optimized touch drawing
- Mask feathering controls (API handles edge blending)

---

## Success Criteria

1. Users can draw precise masks on generated images
2. Inpainting produces natural-looking edits
3. Edit results are saved as new image versions
4. Undo/redo works reliably
5. Performance is acceptable on standard devices (>30fps drawing)
6. Error states are handled gracefully
