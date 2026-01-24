# SPEC-ANALYZE-REFACTOR

## Overview
Refactor floor plan upload flow to unify upload and analysis into a single endpoint that properly integrates with `floor_plan_analyzer.py`.

## Current State
- `/api/floor-plan/upload` (route.ts) - handles file upload, calls LLM service, stores images, creates rooms
- `lib/llm/client.ts` - client for LLM service
- `LLM/src/api.py` - FastAPI with `/analyze` and `/analyze/image` endpoints
- `LLM/src/floor_plan_analyzer.py` - FloorPlanAnalyzer class (RasterScan + Claude Vision)

## Target State

### 1. Rename Endpoint
```
/api/floor-plan/upload → /api/floor-plan/upload-and-analyse
```

### 2. Data Flow
```
page.tsx (FloorplanUploader)
    ↓
/api/floor-plan/upload-and-analyse/route.ts
    ↓ (stores file to blob storage)
    ↓
lib/llm/client.ts → analyzeFloorPlan()
    ↓
LLM Service: POST /analyze
    ↓
floor_plan_analyzer.py → FloorPlanAnalyzer.analyze()
    ↓ (RasterScan API for segmentation)
    ↓ (Claude Vision API for room extraction)
    ↓
Returns: { rooms, annotated_image_base64, room_count, total_area_sqft }
    ↓
upload-and-analyse/route.ts
    ↓ (saves annotated image to blob)
    ↓ (creates room records in DB)
    ↓
Returns SSE events: progress → complete
```

### 3. Single LLM Endpoint
- Use only `/analyze` endpoint (not `/analyze/image`)
- Extract `annotated_image_base64` from JSON response
- Decode base64 to save annotated image

## Files to Modify

### Next.js App
1. **Rename:** `app/api/floor-plan/upload/` → `app/api/floor-plan/upload-and-analyse/`
2. **Update:** `route.ts` - add logging at key integration points
3. **Update:** `components/floorplan/floorplan-uploader.tsx` - update endpoint URL
4. **Update:** `lib/llm/client.ts` - add logging

### LLM Service
1. **Update:** `LLM/src/api.py` - add request/response logging to `/analyze` endpoint
2. **Keep:** `LLM/src/floor_plan_analyzer.py` - existing print() statements sufficient

## Logging Strategy

### Info Level Logs (stdout)
```
[upload-and-analyse] Request received: projectId=123, filename=floor.png
[upload-and-analyse] File stored: /floor-plans/abc123.png
[upload-and-analyse] Calling LLM service...
[llm-client] POST /analyze - sending image (2.5MB)
[llm-client] Response received: 5 rooms detected, 1850 sqft
[upload-and-analyse] Annotated image saved
[upload-and-analyse] Created 5 room records
[upload-and-analyse] Complete
```

### LLM Service Logs
```
[api] POST /analyze received (image: 2.5MB, context: residential)
[floor_plan_analyzer] Analyzing 1920x1080 image...
[floor_plan_analyzer] RasterScan overlay: received
[floor_plan_analyzer] Claude extracted 5 rooms
[api] POST /analyze complete (5 rooms, 1850 sqft)
```

## Test Plan

### Unit Tests (Mocked)

#### Python Tests (`LLM/tests/test_api.py`)
```python
# Mock RasterScan API responses
# Mock Claude Vision API responses
# Test /analyze endpoint returns correct structure
# Test /analyze handles missing image
# Test /analyze handles invalid image format
# Test /analyze handles RasterScan failure gracefully
# Test /analyze handles Claude failure gracefully
```

#### TypeScript Tests (`__tests__/api/floor-plan/`)
```typescript
// Mock fetch to LLM service
// Test upload-and-analyse creates room records
// Test upload-and-analyse saves both images
// Test upload-and-analyse returns SSE events in order
// Test upload-and-analyse handles LLM service errors
// Test upload-and-analyse validates file type
// Test upload-and-analyse validates file size
```

### Visual Confirmation

#### 1. CLI Test (curl)
```bash
# Start LLM service
cd LLM && python -m uvicorn src.api:app --port 8000

# Test /analyze endpoint directly
curl -X POST http://localhost:8000/analyze \
  -F "image=@test-floor-plan.png" \
  -F "context=residential"

# Check response has rooms and annotated_image_base64
```

#### 2. UI Test (browser)
```bash
# Start Next.js dev server
npm run dev

# Navigate to: http://localhost:3000/project/new
# Create project, go to upload step
# Upload test floor plan image
# Watch browser console + terminal for logs
# Verify: rooms appear, annotated image displays
```

## Acceptance Criteria

- [ ] `/api/floor-plan/upload-and-analyse` endpoint exists and works
- [ ] Old `/api/floor-plan/upload` removed or redirects
- [ ] Logs show complete request flow from Next.js to floor_plan_analyzer
- [ ] Mock tests pass for both Python and TypeScript
- [ ] Manual curl test returns valid room data
- [ ] UI upload flow works end-to-end
- [ ] Annotated floor plan image displays in UI
- [ ] Room records created in database with correct data
