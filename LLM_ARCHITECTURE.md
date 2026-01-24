# LLM Architecture & Object Selection

## LLMs Currently Used

### 1. **Claude Sonnet 4** (Primary LLM)
**Used for:**
- **Object Detection** (`lib/klein/object-detection.ts`)
  - Model: `claude-sonnet-4-20250514`
  - Purpose: Identifies objects with bounding boxes
  - Input: Room image (base64 encoded)
  - Output: `DetectedObject[]` with `{ id, label, category, bbox }`
  - Called: After every image generation, and for images missing detection

- **Intent Parsing** (`lib/klein/parser.ts`)
  - Model: `claude-sonnet-4-20250514`
  - Purpose: Parses user text into structured JSON instructions
  - Input: User chat message + available objects + selectedObjectId
  - Output: `ParsedInstruction` with `{ intent, edits, constraints, roomId }`
  - Called: On every chat message before image generation

- **Chat Assistant** (`app/api/chat/route.ts`)
  - Model: `claude-sonnet-4-20250514`
  - Purpose: Conversational AI assistant with context awareness
  - Input: Chat messages + selected object + current image context
  - Output: Streaming text responses
  - System Prompt: `lib/ai/prompts.ts` (includes selected object and current image context)
  - Called: On every chat message

### 2. **Python LLM Service** (Optional Enhancement)
**Used for:**
- **Furniture Analysis** (`LLM/src/furniture_analyzer.py`)
  - Model: `claude-sonnet-4-20250514` (via Python Anthropic SDK)
  - Purpose: Extracts colors, styles, materials from furniture
  - Input: Room image (sent via Next.js proxy)
  - Output: `{ objects: [{ name, category, primary_color, style_tags, material_tags, description }] }`
  - Proxy Route: `app/api/llm/analyze-furniture/route.ts`
  - Integration: `lib/klein/furniture-enhancer.ts`
  - Called: When `enhanceWithLLM: true` in `detectObjects()` (currently always enabled)

- **Product Search** (`LLM/src/product_search.py`)
  - Model: `claude-sonnet-4-20250514` (via Python Anthropic SDK)
  - Purpose: Generates search queries for finding products
  - Input: Furniture object details
  - Output: Product recommendations with links
  - Proxy Route: `app/api/llm/search-products/route.ts`
  - Called: When searching for products (future feature)

### 3. **FLUX.2 Klein 4B** (Image Generation)
**Used for:**
- **Image Generation** (`lib/klein/runware-client.ts`)
  - Model: `flux-2.0-klein`
  - Purpose: Generates/edits room images
  - Input: `KleinTask[]` with prompts + masks (for inpainting)
  - Output: Generated image URLs from Runware API
  - Task Builder: `lib/klein/task-builder.ts`
  - API Endpoint: `POST https://api.runware.ai/v1/generate`
  - Called: After intent parsing, via `executeKleinTasks()`

## Two Methods of Object Identification

There are **two different identification methods** that work together:

### Method 1: **Basic Detection (Claude Vision)** - PRIMARY
**File**: `lib/klein/object-detection.ts`

**What it uses:**
- **LLM**: Claude Sonnet 4 Vision API (`claude-sonnet-4-20250514`)
- **Input**: Room image URL (fetched and converted to base64)
- **Prompt**: Structured prompt asking for objects with bounding boxes
- **Schema**: Zod schema for structured output
- **Output**: 
  ```typescript
  DetectedObject[] {
    id: string,           // e.g., "obj_sofa"
    label: string,        // e.g., "sofa"
    category: string,    // "furniture" | "surface" | "lighting" | "architectural"
    bbox: [x1, y1, x2, y2] // Normalized coordinates 0-1
  }
  ```

**How it works:**
1. `detectObjects(imageUrl, options?)` is called
2. Fetches the generated room image
3. Converts to base64 data URL
4. Sends to Claude Vision with structured schema (Zod)
5. Claude returns JSON with objects and bounding boxes
6. Returns `DetectedObject[]` or `null` on failure
7. If `enhanceWithLLM: true`, calls Method 2 for enrichment

**When used**: Always (primary method, called after every image generation)

**Called from:**
- `app/api/chat/route.ts` - After image generation
- `app/api/klein/generate/route.ts` - After image generation
- `app/api/rooms/[id]/detect-objects/route.ts` - For images missing detection

---

### Method 2: **Enhanced Detection (Python LLM Service)** - OPTIONAL ENRICHMENT
**Files**: 
- `lib/klein/furniture-enhancer.ts` (TypeScript integration)
- `app/api/llm/analyze-furniture/route.ts` (Next.js proxy)
- `LLM/src/furniture_analyzer.py` (Python service)

**What it uses:**
- **LLM**: Claude Sonnet 4 Vision API (via Python service at `http://localhost:8000`)
- **Input**: Room image (sent to Python FastAPI service)
- **Python Service**: `LLM/src/api.py` (FastAPI app)
- **Output**:
  ```typescript
  {
    status: 'success',
    objects: [{
      name: string,              // e.g., "Three-Seat Sofa"
      category: string,          // e.g., "sofa"
      primary_color: string,     // e.g., "#A0937D" (hex)
      style_tags: string[],     // e.g., ["rustic", "traditional"]
      material_tags: string[],  // e.g., ["fabric"]
      description: string        // e.g., "Beige fabric three-seat sofa..."
    }]
  }
  ```

**How it works:**
1. `analyzeFurnitureWithLLM(imageUrl)` in `furniture-enhancer.ts` is called
2. Fetches image and converts to File/FormData
3. Calls `/api/llm/analyze-furniture` (Next.js proxy route)
4. Proxy forwards to Python service `/analyze-furniture`
5. Python service (`furniture_analyzer.py`) uses Claude Vision to analyze furniture
6. Returns colors, styles, materials for each object
7. `mergeFurnitureAnalysis()` in `furniture-enhancer.ts` matches and enriches basic detection
8. Matches by name similarity (exact → partial → category)
9. Combines bbox data (from Method 1) with furniture details (from Method 2)

**When used**: Always enabled (was optional, now hardcoded to `true`)

**Result**: Rich objects with both location (bbox) AND style/color/material info

---

## UI Display Method

**Current Implementation**: **Chips Below Image Only**

**File**: `components/rooms/room-image-viewer.tsx`

**Data Source**: `detectedObjects` from `currentImage.detected_items` (parsed JSON)

**Display**: 
- Button chips in "Editable Objects" section below the image
- Shows object labels (e.g., "sofa", "table", "floor")
- Selected object shows checkmark (✓)
- Clicking a chip calls `onObjectSelect(object)`

**Removed**: Yellow bounding box overlays (removed for cleaner UX)

**Selection Flow**:
1. User clicks chip → `handleObjectSelect()` in `app/(dashboard)/project/[id]/page.tsx`
2. Sets `selectedObject` state
3. Updates chat placeholder to "Editing [object label]..."
4. Passes `selectedObjectId` to chat API
5. Chat API uses selected object for editing

---

## Current Flow

```
User generates image
  ↓
Claude Sonnet 4 detects objects (bbox + labels) [lib/klein/object-detection.ts]
  ↓
[Optional] Python LLM enriches with colors/styles [lib/klein/furniture-enhancer.ts]
  ↓
Objects saved to DB: room_images.detected_items (JSON string)
  ↓
UI renders chips below image [components/rooms/room-image-viewer.tsx]
  ↓
User clicks chip → handleObjectSelect() [app/(dashboard)/project/[id]/page.tsx]
  ↓
Selected object passed to chat (selectedObjectId)
  ↓
User types edit request
  ↓
Claude Sonnet 4 parses intent [lib/klein/parser.ts]
  - Forces edit_objects intent if selectedObjectId exists
  - Uses currentImageId to find correct image
  ↓
FLUX.2 Klein generates inpainting task [lib/klein/task-builder.ts]
  - Creates mask from selected object's bbox
  - Uses restrictive prompt to prevent drift
  ↓
Runware API generates edited image [lib/klein/runware-client.ts]
  ↓
New image with edited object
  ↓
Objects detected again (reuses object IDs for edits)
```

## Key Files Reference

### Core Klein Workflow
- `lib/klein/types.ts` - TypeScript interfaces (`RoomImage`, `DetectedObject`, `ParsedInstruction`, `KleinTask`)
- `lib/klein/parser.ts` - Intent parsing (`parseUserIntent()`)
- `lib/klein/task-builder.ts` - Klein task creation (`buildKleinTasks()`)
- `lib/klein/runware-client.ts` - Runware API client (`executeKleinTasks()`)
- `lib/klein/object-detection.ts` - Object detection (`detectObjects()`)

### LLM Enhancement
- `lib/klein/furniture-enhancer.ts` - Python LLM service integration
- `app/api/llm/analyze-furniture/route.ts` - Next.js proxy to Python service
- `app/api/llm/search-products/route.ts` - Product search proxy
- `LLM/src/api.py` - Python FastAPI service
- `LLM/src/furniture_analyzer.py` - Furniture analysis with Claude Vision
- `LLM/src/product_search.py` - Product search with Claude

### Chat & UI
- `app/api/chat/route.ts` - Main chat API (orchestrates Klein workflow)
- `lib/ai/prompts.ts` - System prompts (includes selected object + current image context)
- `components/rooms/room-image-viewer.tsx` - Image viewer with object chips
- `app/(dashboard)/project/[id]/page.tsx` - Main project page (state management)
- `components/chat/chat-wrapper.tsx` - Chat wrapper component
- `hooks/use-chat.ts` - Custom chat hook with image generation awareness

### Database
- `lib/db/queries.ts` - Database queries (`getRoomImagesByRoomId()`, `createRoomImage()`, `updateRoomImageItems()`)
- `lib/db/index.ts` - SQLite database connection

### API Routes
- `app/api/klein/generate/route.ts` - Direct Klein generation endpoint
- `app/api/rooms/[id]/images/route.ts` - Room images CRUD
- `app/api/rooms/[id]/detect-objects/route.ts` - Batch object detection for missing images

## LLM Call Summary

| Task | LLM | File | When Called |
|------|-----|------|-------------|
| Object Detection | Claude Sonnet 4 | `lib/klein/object-detection.ts` | After image generation, for missing detections |
| Intent Parsing | Claude Sonnet 4 | `lib/klein/parser.ts` | On every chat message before image generation |
| Chat Assistant | Claude Sonnet 4 | `app/api/chat/route.ts` | On every chat message |
| Furniture Analysis | Claude Sonnet 4 (Python) | `LLM/src/furniture_analyzer.py` | Always (via `furniture-enhancer.ts`) |
| Product Search | Claude Sonnet 4 (Python) | `LLM/src/product_search.py` | When searching for products (future) |
| Image Generation | FLUX.2 Klein | `lib/klein/runware-client.ts` | After intent parsing, via `executeKleinTasks()` |

## Context Awareness

### Selected Object Context
- **Frontend**: `selectedObject` state in `app/(dashboard)/project/[id]/page.tsx`
- **Chat API**: Receives `selectedObjectId` in request body
- **Parser**: Forces `edit_objects` intent if `selectedObjectId` exists
- **System Prompt**: Includes selected object context via `lib/ai/prompts.ts`
- **Result**: Chat AI knows which object to edit, responds directly without asking

### Current Image Context
- **Frontend**: `currentImageId` passed to chat via `ChatWrapper`
- **Chat API**: Receives `currentImageId` in request body
- **Image Selection**: Uses `currentImageId` to find correct image for editing
- **System Prompt**: Includes current image context (ID + URL)
- **Result**: Chat AI edits the image user is viewing, not a different one

### Object Detection Status
- **Database**: `room_images.detected_items` stores JSON string or `null`
- **Values**: 
  - `null` = Detection failed (sentinel)
  - `'[]'` = Detection not run yet OR detection succeeded but found no objects
  - `'[{...}]'` = Detection succeeded with objects
- **Auto-Detection**: Polling and initial fetch trigger detection for images missing `detected_items`
- **Endpoint**: `app/api/rooms/[id]/detect-objects/route.ts` processes all images in a room
