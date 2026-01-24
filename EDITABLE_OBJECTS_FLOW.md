# Where "Editable Objects" Come From

## Complete Flow

```
1. USER GENERATES IMAGE
   ↓
2. IMAGE GENERATION (FLUX.2 Klein)
   ↓
3. OBJECT DETECTION (Claude Sonnet 4)
   ↓
4. SAVE TO DATABASE
   ↓
5. RETRIEVE FROM DATABASE
   ↓
6. SEND TO FRONTEND
   ↓
7. DISPLAY AS "EDITABLE OBJECTS"
```

---

## Step-by-Step Details

### Step 1: User Generates Image
**Location**: User types in chat → `app/api/chat/route.ts`

### Step 2: Image Generation
**Location**: `app/api/chat/route.ts` (lines 131-137)
```typescript
const tasks = await buildKleinTasks(parsedInstruction, previousImage);
const imageUrls = await executeKleinTasks(tasks);
const finalImageUrl = imageUrls[imageUrls.length - 1];
```
- FLUX.2 Klein generates the room image
- Returns image URL

### Step 3: Object Detection
**Location**: `app/api/chat/route.ts` (lines 150-152)
```typescript
detectedObjects = await detectObjects(finalImageUrl, {
  enhanceWithLLM: process.env.ENABLE_LLM_ENHANCEMENT === 'true',
});
```

**What happens:**
- Calls `lib/klein/object-detection.ts`
- Uses **Claude Sonnet 4 Vision API**
- Analyzes the generated image
- Returns: `DetectedObject[]` with `{ id, label, category, bbox }`

**Example output:**
```typescript
[
  { id: "obj_sofa", label: "sofa", category: "furniture", bbox: [0.12, 0.48, 0.68, 0.82] },
  { id: "obj_table", label: "coffee table", category: "furniture", bbox: [0.42, 0.62, 0.58, 0.72] }
]
```

### Step 4: Save to Database
**Location**: `app/api/chat/route.ts` (lines 159-164)
```typescript
const detectedItemsJson = detectedObjects !== null 
  ? JSON.stringify(detectedObjects) 
  : null;

const newImage = createRoomImage(
  Number(roomId),
  finalImageUrl,
  userContent,
  'perspective',
  detectedItemsJson  // ← Saved here
);
```

**Database**: `lib/db/queries.ts` (line 261-315)
- Table: `room_images`
- Column: `detected_items` (TEXT/JSON)
- Function: `createRoomImage()`

**Storage format:**
```sql
INSERT INTO room_images (room_id, url, prompt, view_type, detected_items)
VALUES (?, ?, ?, ?, ?)
-- detected_items = '[{"id":"obj_sofa","label":"sofa",...}]'
```

### Step 5: Retrieve from Database
**Location**: `lib/db/queries.ts` (line 229-258)
```typescript
const images = queryAll<RoomImage>(
  'SELECT id, room_id, url, prompt, view_type, detected_items, created_at 
   FROM room_images 
   WHERE room_id = ? 
   ORDER BY created_at DESC',
  [roomId]
);
```

**Function**: `getRoomImagesByRoomId(roomId)`
- Returns array of `RoomImage` objects
- Each includes `detected_items` column (JSON string)

### Step 6: Send to Frontend
**Location**: `app/api/rooms/[id]/images/route.ts` (GET endpoint, lines 28-72)

```typescript
const images = getRoomImagesByRoomId(roomId);

const normalizedImages = images.map((img) => ({
  id: img.id,
  url: img.url,
  prompt: img.prompt,
  view_type: img.view_type,
  detected_items: img.detected_items ?? '[]',  // ← Sent to frontend
  created_at: img.created_at,
}));

return NextResponse.json({ images: normalizedImages });
```

**API Endpoint**: `GET /api/rooms/[id]/images`
- Returns JSON with `images` array
- Each image has `detected_items` field

### Step 7: Frontend Receives & Displays
**Location**: `app/(dashboard)/project/[id]/page.tsx` (lines 100-139)

**Fetch:**
```typescript
const res = await fetch(`/api/rooms/${selectedRoomId}/images`);
const data = await res.json();
setRoomImages(data.images || []);
```

**Pass to Component:**
```typescript
<RoomImageViewer
  images={roomImages}  // ← Contains detected_items
  ...
/>
```

**Parse & Display:**
**Location**: `components/rooms/room-image-viewer.tsx` (lines 90-123)

```typescript
const detected_items = currentImage.detected_items;

// Parse JSON string
const parsed = typeof detected_items === 'string' 
  ? JSON.parse(detected_items) 
  : detected_items;

// Normalize to DetectedObject[]
detectedObjects = parsed.map((obj: any) => ({
  id: obj.id,
  label: obj.label,
  category: obj.category,
  bbox: obj.bbox,
}));
```

**Display as "Editable Objects":**
**Location**: `components/rooms/room-image-viewer.tsx` (lines 344-367)

```typescript
{detectedObjects.length > 0 && (
  <div className="border-t border-white/10 bg-surface/30 p-3">
    <p className="text-xs text-white/50 mb-2">Editable Objects</p>
    <div className="flex flex-wrap gap-2">
      {detectedObjects.map((obj) => (
        <button onClick={() => handleObjectClick(obj)}>
          {obj.label} {isSelected && '✓'}
        </button>
      ))}
    </div>
  </div>
)}
```

---

## Summary

**"Editable Objects" come from:**

1. **Detection**: Claude Sonnet 4 Vision API analyzes the generated image
2. **Storage**: Saved as JSON string in `room_images.detected_items` column
3. **Retrieval**: Fetched from database via `getRoomImagesByRoomId()`
4. **API**: Sent to frontend via `GET /api/rooms/[id]/images`
5. **Frontend**: Parsed from JSON and displayed as chips/overlays

**Key Files:**
- Detection: `lib/klein/object-detection.ts`
- Database: `lib/db/queries.ts` (`createRoomImage`, `getRoomImagesByRoomId`)
- API: `app/api/rooms/[id]/images/route.ts`
- Frontend: `components/rooms/room-image-viewer.tsx`

**Database Column:**
- Table: `room_images`
- Column: `detected_items` (TEXT)
- Format: JSON string like `'[{"id":"obj_sofa","label":"sofa",...}]'`

