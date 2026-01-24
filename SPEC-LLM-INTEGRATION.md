# LLM Floor Plan Analyzer Integration Spec

## Overview

This document specifies how to integrate the standalone Python LLM floor plan analyzer service (`/LLM`) into the Next.js application's floor plan workflow (`/app/api/floor-plan`).

**Goal:** Replace the mock room detection in `/api/floor-plan/parse` with real AI-powered analysis using RasterScan + Claude Vision.

---

## Architecture Decision

**Approach:** Separate services with HTTP communication

Both services run independently on localhost. Next.js makes HTTP calls to the Python FastAPI service.

```
┌─────────────────────┐                    ┌─────────────────────────────┐
│   Next.js App       │                    │   LLM Service (Python)      │
│   (Port 3000)       │─────HTTP──────────▶│   (Port 8000)               │
│                     │   localhost:8000    │                             │
│   - Frontend        │                    │   - FastAPI                 │
│   - API Routes      │                    │   - RasterScan client       │
│   - S3 integration  │                    │   - Claude Vision client    │
└─────────────────────┘                    └─────────────────────────────┘
          │                                            │
          ▼                                            ▼
┌─────────────────────┐                    ┌─────────────────────────────┐
│   SQLite DB         │                    │   External APIs             │
│                     │                    │   - RasterScan              │
└─────────────────────┘                    │   - Claude API              │
          │                                └─────────────────────────────┘
          ▼
┌─────────────────────┐
│   S3 Blob Storage   │
│                     │
└─────────────────────┘
```

**Running the Services:**

1. **Start LLM Service:**
   ```bash
   cd LLM
   uv pip install -r requirements.txt
   uv run uvicorn src.api:app --host 0.0.0.0 --port 8000
   ```

2. **Start Next.js:**
   ```bash
   npm run dev  # Runs on port 3000
   ```

**Service Endpoints:**
- Next.js: `http://localhost:3000`
- LLM Service: `http://localhost:8000`

---

## Data Flow

### New Unified Upload + Analyze Flow

```
User uploads floor plan image
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/floor-plan/upload (unified endpoint)                 │
│                                                                  │
│  1. Receive image bytes from frontend                           │
│  2. Open SSE connection for progress updates                    │
│  3. Stream "analyzing" status                                   │
│  4. POST image bytes to LLM service (http://localhost:8000)     │
│  5. Receive: rooms JSON + annotated_image_base64                │
│  6. Stream "uploading" status                                   │
│  7. Save original image to S3 → floor_plan_url                  │
│  8. Save annotated image to S3 → annotated_floor_plan_url       │
│  9. Create room records in database                             │
│  10. Stream "complete" with final data                          │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
Frontend receives: {
  floor_plan_url,
  annotated_floor_plan_url,
  rooms: [...],
  room_count,
  total_area_sqft
}
```

**Key Change:** Image bytes go to LLM service FIRST, then to S3 storage. This avoids downloading from S3 to re-upload to LLM.

---

## API Changes

### Modified: POST `/api/floor-plan/upload`

Replaces both the current upload and parse endpoints with a single unified endpoint.

**Request:**
```typescript
// Content-Type: multipart/form-data
{
  file: File,        // Floor plan image (PNG, JPG, PDF)
  projectId: string  // Project to associate with
}
```

**Response:** Server-Sent Events stream

```typescript
// Event: progress
data: { status: "analyzing", message: "Detecting rooms with AI..." }

// Event: progress
data: { status: "uploading", message: "Saving images to storage..." }

// Event: complete
data: {
  floor_plan_url: string,
  annotated_floor_plan_url: string,
  rooms: Room[],
  room_count: number,
  total_area_sqft: number
}

// Event: error (if failure)
data: { error: string, message: "Analysis failed. Please try again." }
```

**Error Handling:**
- If either RasterScan OR Claude Vision fails → return error, prompt user to retry
- No partial results - both services must succeed

### Deprecated: POST `/api/floor-plan/parse`

This endpoint will be removed. Its functionality is absorbed into the unified upload endpoint.

### New: GET `/api/floor-plan/health`

Health check for the LLM service connection.

```typescript
// Response
{
  status: "healthy" | "unhealthy",
  llm_service: {
    reachable: boolean,
    latency_ms: number
  }
}
```

---

## LLM Service Interface

### Endpoint: POST `/analyze`

**Request:**
```
Content-Type: multipart/form-data
- file: Image file (PNG, JPG, GIF, WebP)
- context: Optional string (user hints about the floor plan)
```

**Response:**
```json
{
  "status": "success",
  "rooms": [
    {
      "name": "Living Room",
      "type": "living_area",
      "area_sqft": 300,
      "dimensions": "20ft x 15ft",
      "width_ft": 20,
      "length_ft": 15,
      "fixtures": ["sofa", "coffee table", "TV stand"],
      "doors": [
        { "position": "north", "connects_to": "Hallway" }
      ],
      "windows": [
        { "position": "east", "count": 2, "type": "standard" }
      ],
      "adjacent_rooms": ["Kitchen", "Hallway"]
    }
  ],
  "annotated_image_base64": "iVBORw0KGgo...",
  "total_area_sqft": 1850,
  "room_count": 6
}
```

### Room Types Supported

```typescript
type RoomType =
  | "living_area"      // Living room, family room, great room
  | "bedroom"          // Bedrooms, primary bedroom, guest room
  | "bathroom"         // Full bath, half bath, powder room
  | "kitchen"          // Kitchen, kitchenette
  | "dining"           // Dining room, breakfast nook
  | "office"           // Home office, study, den
  | "laundry"          // Laundry room, utility room
  | "garage"           // Garage, carport
  | "storage"          // Closets, pantry, storage
  | "hallway"          // Hallways, corridors, foyer
  | "outdoor"          // Patio, deck, balcony
  | "other";           // Unclassified spaces
```

---

## Database Schema Updates

### Rooms Table Changes

Update geometry field to use imperial units:

```sql
-- Current (metric)
geometry JSON  -- { length_m, width_m, area_sqm }

-- New (imperial)
geometry JSON  -- { length_ft, width_ft, area_sqft }
```

**Migration:**
```sql
-- No migration needed for existing mock data
-- New rooms will be stored with imperial geometry
```

### Projects Table Addition

Add field for annotated floor plan:

```sql
ALTER TABLE projects ADD COLUMN annotated_floor_plan_url TEXT;
```

---

## SPEC.md Updates Required

### Section: Floor Plan Upload & Parsing

Update Auto-Detection API Response to use imperial:

```json
{
  "total_rooms": 3,
  "total_area_sqft": 1850,
  "rooms": [
    {
      "id": "room_001",
      "name": "Living Room",
      "type": "living_area",
      "geometry": {
        "length_ft": 20,
        "width_ft": 15,
        "area_sqft": 300
      },
      "doors": [{ "position": "north", "connects_to": "hallway" }],
      "windows": [{ "position": "east", "count": 2 }],
      "fixtures": ["sofa", "coffee_table"],
      "adjacent_rooms": ["hallway", "kitchen"]
    }
  ]
}
```

### Section: Remove Confidence Levels

Remove references to `confidence_level: "high|medium|low"`. All room detection results are presented as suggestions that users can always edit, add, or delete.

### Section: Per-Room State

Update RoomGeometry interface:

```typescript
interface RoomGeometry {
  length_ft: number;
  width_ft: number;
  area_sqft: number;
}
```

---

## Frontend Changes

### FloorplanUploader Component

Update to use SSE for progress:

```typescript
interface UploadProgress {
  status: "analyzing" | "uploading" | "complete" | "error";
  message: string;
  data?: {
    floor_plan_url: string;
    annotated_floor_plan_url: string;
    rooms: Room[];
    room_count: number;
    total_area_sqft: number;
  };
}

// Usage
const eventSource = new EventSource(`/api/floor-plan/upload?projectId=${projectId}`);
eventSource.onmessage = (event) => {
  const progress: UploadProgress = JSON.parse(event.data);
  // Update UI based on progress.status
};
```

### Room Sidebar Enhancement

Show both original and annotated floor plan:

```tsx
<FloorPlanPreview
  originalUrl={project.floor_plan_url}
  annotatedUrl={project.annotated_floor_plan_url}
  showAnnotated={showAnnotated}
  onToggle={() => setShowAnnotated(!showAnnotated)}
/>
```

### Manual Room Entry

Always available regardless of detection results. Users can:
- Add new rooms not detected
- Edit detected room names, types, dimensions
- Delete incorrectly detected rooms
- Modify fixtures, doors, windows

---

## Environment Variables

### Required in `.env` (Next.js)

```env
# Database
DATABASE_URL=sqlite.db

# AI Services
ANTHROPIC_API_KEY=sk-ant-...

# Image Generation
BFL_API_KEY=...

# Storage
BLOB_STORAGE_URL=...

# LLM Service
LLM_SERVICE_URL=http://localhost:8000
```

### Required in `LLM/.env` (Python service)

```env
# AI Services
ANTHROPIC_API_KEY=sk-ant-...
RASTERSCAN_API_KEY=...
RASTERSCAN_URL=https://backend.rasterscan.com/raster-to-vector-base64
```

---

## Implementation Tasks

### Phase 1: Environment Setup
1. Configure `LLM/.env` with ANTHROPIC_API_KEY and RASTERSCAN_API_KEY
2. Add `LLM_SERVICE_URL=http://localhost:8000` to root `.env`
3. Start LLM service: `cd LLM && uv pip install -r requirements.txt && uv run uvicorn src.api:app --host 0.0.0.0 --port 8000`
4. Verify LLM service health: `curl http://localhost:8000/health`

### Phase 2: API Integration
1. Create new unified `/api/floor-plan/upload` with SSE
2. Add LLM service client utility (`lib/llm-client.ts`)
3. Handle multipart form data streaming to LLM service
4. Save annotated image to S3
5. Create room records from LLM response

### Phase 3: Database Updates
1. Add `annotated_floor_plan_url` column to projects
2. Update room geometry to use imperial units
3. Remove/deprecate old parse endpoint

### Phase 4: Frontend Updates
1. Update FloorplanUploader to use SSE
2. Add progress indicators for analyzing/uploading states
3. Add toggle for original/annotated floor plan view
4. Ensure manual room entry always available

### Phase 5: Testing & Polish
1. Test full flow end-to-end with both services running
2. Test error handling (LLM service down, timeout, etc.)
3. Test large file uploads
4. Performance testing with various floor plan sizes

---

## Error Scenarios

| Scenario | Behavior |
|----------|----------|
| LLM service unreachable | Return error, show "Service temporarily unavailable. Please try again." |
| RasterScan API fails | Return error, prompt retry |
| Claude Vision fails | Return error, prompt retry |
| S3 upload fails | Return error, prompt retry |
| File too large (>20MB) | Client-side validation, reject before upload |
| Invalid file type | Client-side validation, reject before upload |
| Request timeout (>60s) | Return error, prompt retry |

---

## Security Considerations

1. **File Validation:** Validate file type and size both client-side and server-side
2. **Rate Limiting:** Implement rate limiting on upload endpoint (prevent abuse)
3. **LLM Service Access:** Configure CORS on LLM service to only accept requests from Next.js origin
4. **API Keys:** All API keys stored in environment variables, never exposed to client
5. **S3 Access:** Use signed URLs with expiration for floor plan images
6. **Network Security:** In production, consider running LLM service behind a reverse proxy or VPN

---

## Success Metrics

- Room detection accuracy: >90% of rooms correctly identified
- Processing time: <30 seconds for typical floor plans
- Error rate: <5% of uploads fail
- User satisfaction: Users accept AI-detected rooms without manual edits >70% of time
