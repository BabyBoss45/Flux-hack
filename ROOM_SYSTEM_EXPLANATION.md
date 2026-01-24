# How Rooms Work in the Current System

## Overview

The room system uses a **dual-identity approach**:
- **Database**: Rooms stored with numeric IDs (e.g., `id: 8`)
- **Client-side**: Rooms identified by stable string keys (e.g., `"living-room"`)

This design was chosen for the hackathon to avoid dependency on potentially broken database IDs while maintaining compatibility with existing DB structure.

---

## Architecture: Two-Layer Identity System

### Layer 1: Database (Backend)
```typescript
interface Room {
  id: number;           // DB primary key (e.g., 8, 9, 10)
  project_id: number;
  name: string;         // "Living Room", "Kitchen", etc.
  type: string;         // "living-room", "kitchen", etc.
  approved: number;     // 0 or 1
  // ... other fields
}
```

**Storage**: SQLite database, rooms table
**Purpose**: Persistent storage, image associations, message filtering

### Layer 2: Client-Side Keys (Frontend)
```typescript
type RoomKey = 'living-room' | 'kitchen' | 'bedroom' | 'bathroom' | 'dining' | 'office' | 'other';
```

**Storage**: React state (`selectedRoomKey`)
**Purpose**: UI state management, chat communication, AI context

---

## Data Flow: Complete Journey

### 1. **Initial Load** (`app/(dashboard)/project/[id]/page.tsx`)

```typescript
// Step 1: Fetch rooms from database
const res = await fetch(`/api/projects/${projectId}`);
const data = await res.json();
setRooms(data.rooms); // [{ id: 8, name: "Living Room", type: "living-room", ... }]

// Step 2: Auto-select first room by computing its key
if (fetchedRooms.length > 0) {
  const firstRoom = fetchedRooms[0];
  const firstRoomKey = getRoomKey(firstRoom); // "living-room"
  setSelectedRoomKey(firstRoomKey);
}
```

**Key Function**: `getRoomKey(room: Room): RoomKey`
- Analyzes `room.name` and `room.type`
- Maps to stable key: `"Living Room"` → `"living-room"`
- Fallback: `"other"` if no match

### 2. **Room Selection** (User clicks room button)

```typescript
// RoomGrid component
<button onClick={() => onSelectRoom(room.key)}>
  {room.name}
</button>

// Page handler
const handleRoomSelect = (roomKey: RoomKey) => {
  setSelectedRoomKey(roomKey); // Update state
  setSelectedObject(null);      // Clear object selection
  setCurrentImageIndex(0);      // Reset image view
};
```

**What happens**:
1. User clicks "Living Room" button
2. `onSelectRoom("living-room")` called
3. `setSelectedRoomKey("living-room")` updates state
4. Room grid re-renders with new selection highlighted

### 3. **Derived State** (Computed from key)

```typescript
// Find the actual DB room from the selected key
const selectedRoom = rooms.find(r => getRoomKey(r) === selectedRoomKey);
const selectedRoomId = selectedRoom?.id || null; // e.g., 8

// This selectedRoomId is used for:
// - Fetching images: `/api/rooms/${selectedRoomId}/images`
// - Object detection: `/api/rooms/${selectedRoomId}/detect-objects`
```

**Why both?**
- `selectedRoomKey`: Used for chat/AI (stable, human-readable)
- `selectedRoomId`: Used for DB queries (numeric, required for API)

### 4. **Chat Communication** (`hooks/use-chat.ts`)

```typescript
// Request body sent to API
{
  projectId: 1,
  roomKey: "living-room",      // ← Client-side key
  currentImageId: 42,
  selectedObjectId: "obj-123"
}
```

**Key Point**: Chat sends `roomKey`, NOT `roomId`

### 5. **Backend Processing** (`app/api/chat/route.ts`)

```typescript
// Step 1: Extract roomKey from request
const { roomKey, currentImageId, ... } = body;

// Step 2: Map roomKey to room context (NO DB lookup!)
const { getRoomContext, getRoomName } = await import('@/lib/ai/room-context');
const roomContext = getRoomContext(roomKey);
// Returns: "Living room – social, seating-focused space..."

const roomName = getRoomName(roomKey);
// Returns: "Living Room"

// Step 3: Create synthetic room object for system prompt
const currentRoom = {
  id: roomKey,              // Use key as ID
  name: roomName,           // "Living Room"
  type: roomKey,            // "living-room"
  project_id: projectId,
  approved: true,
};
```

**Key Point**: Backend doesn't query DB for room - it uses static mapping

### 6. **AI System Prompt** (`lib/ai/prompts.ts`)

```typescript
getSystemPrompt(project, currentRoom, ...)

// Generates:
"You are working on the 'Living Room' (living-room).
- ALL requests from the user are about THIS SPECIFIC ROOM: 'Living Room'
- When the user says 'the room', they mean 'Living Room'
..."
```

**Result**: AI knows which room user is editing without DB lookup

---

## Key Mapping System

### `getRoomKey()` Function

```typescript
function getRoomKey(room: Room): RoomKey {
  const nameLower = room.name.toLowerCase();
  const typeLower = room.type?.toLowerCase() || '';
  
  if (nameLower.includes('living') || typeLower.includes('living')) 
    return 'living-room';
  if (nameLower.includes('kitchen') || typeLower.includes('kitchen')) 
    return 'kitchen';
  if (nameLower.includes('bedroom') || typeLower.includes('bedroom')) 
    return 'bedroom';
  if (nameLower.includes('bathroom') || typeLower.includes('bath')) 
    return 'bathroom';
  if (nameLower.includes('dining') || typeLower.includes('dining')) 
    return 'dining';
  if (nameLower.includes('office') || typeLower.includes('office')) 
    return 'office';
  return 'other';
}
```

**Examples**:
- `{ name: "Living Room", type: "living-room" }` → `"living-room"`
- `{ name: "Kitchen", type: "kitchen" }` → `"kitchen"`
- `{ name: "Master Bedroom", type: "bedroom" }` → `"bedroom"`
- `{ name: "Bath", type: "bathroom" }` → `"bathroom"`

### Room Context Mapping (`lib/ai/room-context.ts`)

```typescript
export const ROOM_PROMPTS = {
  'living-room': 'Living room – social, seating-focused space...',
  'kitchen': 'Kitchen – functional cooking space...',
  'bedroom': 'Bedroom – calm, private space...',
  // ...
};

export function getRoomContext(roomKey: string): string {
  return ROOM_PROMPTS[roomKey] || ROOM_PROMPTS['other'];
}
```

**Purpose**: Provides AI with room-specific context without DB query

---

## State Management

### Page-Level State (`page.tsx`)

```typescript
const [rooms, setRooms] = useState<Room[]>([]);              // DB rooms
const [selectedRoomKey, setSelectedRoomKey] = useState<RoomKey | null>(null);
const [roomImages, setRoomImages] = useState<RoomImage[]>([]);
const [currentImageId, setCurrentImageId] = useState<number | null>(null);
```

### Derived State (Computed)

```typescript
// Computed from selectedRoomKey
const selectedRoom = rooms.find(r => getRoomKey(r) === selectedRoomKey);
const selectedRoomId = selectedRoom?.id || null;
```

**Why computed?**
- `selectedRoomKey` is the source of truth
- `selectedRoomId` is derived when needed for DB operations

---

## Image Association

### Problem
Images are stored with `room_id` (DB ID), but we use `roomKey` for selection.

### Current Solution (Hackathon)
```typescript
// When fetching images, use computed selectedRoomId
useEffect(() => {
  if (!selectedRoomId) return;
  fetch(`/api/rooms/${selectedRoomId}/images`)
    .then(res => res.json())
    .then(data => setRoomImages(data.images));
}, [selectedRoomKey, selectedRoomId]);
```

**Flow**:
1. `selectedRoomKey` changes → `selectedRoomId` recomputed
2. `selectedRoomId` used to fetch images from DB
3. Images displayed in UI

### Future (Production)
- Map `roomKey` → `roomId` explicitly
- Store `roomKey` in image metadata
- Filter images by `roomKey` directly

---

## Chat Integration

### Request Flow

```
User types message
  ↓
ChatWrapper (receives roomKey)
  ↓
useChat hook (sends roomKey in body)
  ↓
API route (extracts roomKey)
  ↓
Maps roomKey → room context
  ↓
AI system prompt (includes room context)
```

### Request Body
```json
{
  "projectId": 1,
  "roomKey": "living-room",
  "currentImageId": 42,
  "selectedObjectId": "obj-123",
  "messages": [...]
}
```

### Backend Processing
```typescript
// NO DB lookup for room!
const roomContext = getRoomContext(roomKey);
const roomName = getRoomName(roomKey);

// Synthetic room object
const currentRoom = {
  id: roomKey,
  name: roomName,
  type: roomKey,
  // ...
};
```

---

## Why This Design?

### Benefits
1. **Stable Identity**: Room keys don't change if DB IDs are broken/reset
2. **Human-Readable**: `"living-room"` is clearer than `8`
3. **No DB Dependency**: Chat works without room DB lookup
4. **Fast**: Static mapping is instant (no query)
5. **Hackathon-Friendly**: Works even if DB has issues

### Trade-offs
1. **Mapping Logic**: Must maintain `getRoomKey()` function
2. **Limited Types**: Only 7 room types supported
3. **No Dynamic Rooms**: Can't add new room types without code change
4. **DB Disconnect**: Room context not from DB (simplified for hackathon)

---

## Current Limitations

### 1. Room Type Restriction
Only these keys are supported:
- `'living-room'`
- `'kitchen'`
- `'bedroom'`
- `'bathroom'`
- `'dining'`
- `'office'`
- `'other'`

**Impact**: Rooms that don't match fall back to `'other'`

### 2. Image Filtering
Images are still fetched by DB `room_id`, not `roomKey`.

**Current**: `getRoomImagesByRoomId(selectedRoomId)`
**Future**: `getRoomImagesByRoomKey(roomKey)`

### 3. Message Association
Messages are saved without `room_id` (set to `null`).

**Current**: `createMessage(projectId, 'user', content, null)`
**Future**: Map `roomKey` → `roomId` when saving

---

## Migration Path (Future)

### Phase 1: Add roomKey to DB
```sql
ALTER TABLE rooms ADD COLUMN room_key TEXT;
UPDATE rooms SET room_key = 'living-room' WHERE type = 'living-room';
```

### Phase 2: Update queries
```typescript
export function getRoomByKey(projectId: number, roomKey: string): Room | undefined {
  return queryOne<Room>(
    'SELECT * FROM rooms WHERE project_id = ? AND room_key = ?',
    [projectId, roomKey]
  );
}
```

### Phase 3: Remove static mapping
- Remove `getRoomKey()` function
- Use DB `room_key` directly
- Update `room-context.ts` to query DB

---

## Summary

**Current System**:
- Frontend uses `roomKey` (stable string)
- Backend maps `roomKey` → context (static)
- DB still uses `roomId` (numeric)
- Bridge: `getRoomKey()` converts DB room → key

**Data Flow**:
```
DB Room (id: 8) 
  → getRoomKey() 
  → "living-room" 
  → UI State 
  → Chat Request 
  → API Mapping 
  → AI Context
```

**Key Insight**: The system decouples UI identity (`roomKey`) from DB identity (`roomId`) to provide stability and simplicity for the hackathon.

