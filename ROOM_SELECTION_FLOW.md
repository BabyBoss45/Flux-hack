# Room Selection Tracking Flow

This document explains how the system tracks which room is currently selected for chat editing.

## Data Flow Overview

```
User clicks room → UI State → ChatWrapper → useChat → API → System Prompt
```

## Step-by-Step Flow

### 1. **UI State (Source of Truth)**
**File:** `app/(dashboard)/project/[id]/page.tsx`

```typescript
const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
```

- **Location:** Page component state
- **Purpose:** Single source of truth for which room is selected
- **Updated when:**
  - User clicks a room in `RoomGrid` component
  - Initial room is auto-selected when project loads (first room)
  - Room changes trigger `handleRoomSelect(roomId)`

### 2. **Room Selection Handler**
**File:** `app/(dashboard)/project/[id]/page.tsx`

```typescript
const handleRoomSelect = (roomId: number) => {
  console.log('[PROJECT PAGE] Room selected:', roomId);
  setSelectedRoomId(roomId);
  // Clear selected object when switching rooms
  setSelectedObject(null);
  // Reset image selection when switching rooms
  setCurrentImageIndex(0);
  setCurrentImageId(null);
};
```

- **Triggered by:** `RoomGrid` component's `onSelectRoom` callback
- **Actions:**
  - Updates `selectedRoomId` state
  - Clears object selection
  - Resets image selection

### 3. **RoomGrid Component**
**File:** `components/rooms/room-grid.tsx`

```typescript
<button
  onClick={() => onSelectRoom(room.id)}
  className={selectedRoomId === room.id ? 'selected' : ''}
>
  {room.name}
</button>
```

- **Visual indicator:** Selected room has highlighted border
- **Callback:** Calls `onSelectRoom(room.id)` which triggers `handleRoomSelect`

### 4. **ChatWrapper Receives Room ID**
**File:** `app/(dashboard)/project/[id]/page.tsx`

```typescript
{selectedRoomId && (
  <ChatWrapper
    key={`chat-${selectedRoomId}`}  // Force remount on room change
    projectId={projectId}
    roomId={selectedRoomId}          // ← Passed to chat
    selectedRoomId={selectedRoomId}  // ← Also passed for consistency
    currentImageId={currentImageId}
    // ... other props
  />
)}
```

- **Key prop:** `key={chat-${selectedRoomId}}` forces remount when room changes
- **roomId prop:** This is what chat uses to identify the room

### 5. **ChatWrapper Passes to useChat**
**File:** `components/chat/chat-wrapper.tsx`

```typescript
const { messages, isLoading, sendMessage, stop } = useChat({
  projectId,
  roomId,  // ← Explicitly passed from UI state
  selectedObjectId,
  currentImageId,
  // ...
});
```

- **roomId:** Comes from props (which came from `selectedRoomId` state)
- **Logging:** Console logs when roomId changes

### 6. **useChat Includes in API Request**
**File:** `hooks/use-chat.ts`

```typescript
transport: new ImageAwareChatTransport({
  api: '/api/chat',
  body: {
    projectId,
    roomId,  // ← Included in every chat request
    selectedObjectId,
    currentImageId,
  },
  // ...
})
```

- **Request body:** Every chat message includes `roomId`
- **No inference:** Room ID is always explicit, never guessed

### 7. **API Validates and Uses Room ID**
**File:** `app/api/chat/route.ts`

```typescript
const { messages, projectId, roomId, selectedObjectId, currentImageId } = body;

// Validate room exists
const currentRoom = getRoomById(Number(roomId));
if (!currentRoom) {
  return new Response(`Room ID ${roomId} not found`, { status: 404 });
}

// Use room in system prompt
const systemPrompt = getSystemPrompt(
  project, 
  currentRoom,  // ← Room object passed to system prompt
  selectedObjectForPrompt,
  availableObjectsForPrompt,
  currentImageForPrompt
);
```

- **Validation:** API verifies room exists and belongs to project
- **System prompt:** Room name and type included in AI context

### 8. **System Prompt Includes Room Context**
**File:** `lib/ai/prompts.ts`

```typescript
export function getSystemPrompt(
  project: Project, 
  currentRoom: Room | null,  // ← Room object
  // ...
): string {
  return `You are an expert interior designer AI assistant...

CRITICAL CONTEXT: You are currently working on the "${currentRoom.name}" (${currentRoom.type}).
- ALL requests from the user are about THIS SPECIFIC ROOM: "${currentRoom.name}"
- When the user says "the room" or "this room", they mean "${currentRoom.name}"
...`;
}
```

- **Room name:** Explicitly mentioned in system prompt
- **Room type:** Included for context
- **Clear instructions:** AI knows which room it's working on

## Key Invariants

1. **Single Source of Truth:** `selectedRoomId` in page component state
2. **Explicit Flow:** Room ID flows explicitly through props, never inferred
3. **No Hardcoding:** No hardcoded room IDs anywhere
4. **Validation:** API validates room exists before using it
5. **Visual Feedback:** UI shows which room is selected

## Debugging

To verify room selection is working:

1. **Check console logs:**
   - `[PROJECT PAGE] Room selected: X`
   - `[PROJECT PAGE] selectedRoomId state changed to: X`
   - `[CHAT INSTANCE] Calling useChat with roomId: X`
   - `[USE CHAT] Sending request with roomId: X`
   - `[CHAT API] Room context: { roomId, roomName, roomType }`

2. **Check UI:**
   - Selected room should have highlighted border in `RoomGrid`
   - Chat should only render when `selectedRoomId` is not null

3. **Check API:**
   - System prompt should include room name
   - AI responses should reference the correct room

## State Management

```
┌─────────────────────────────────────┐
│  Page Component State               │
│  selectedRoomId: number | null      │  ← SOURCE OF TRUTH
└──────────────┬──────────────────────┘
               │
               │ Props
               ▼
┌─────────────────────────────────────┐
│  ChatWrapper                        │
│  roomId prop (from selectedRoomId)  │
└──────────────┬──────────────────────┘
               │
               │ Props
               ▼
┌─────────────────────────────────────┐
│  useChat Hook                       │
│  roomId in request body             │
└──────────────┬──────────────────────┘
               │
               │ HTTP Request
               ▼
┌─────────────────────────────────────┐
│  API Route (/api/chat)              │
│  Fetches room by ID                 │
│  Includes in system prompt          │
└─────────────────────────────────────┘
```

## Summary

The room selection is tracked through a clear, explicit data flow:
1. User clicks room → `handleRoomSelect` updates `selectedRoomId` state
2. `selectedRoomId` passed as `roomId` prop to `ChatWrapper`
3. `ChatWrapper` passes `roomId` to `useChat` hook
4. `useChat` includes `roomId` in every API request
5. API validates room and includes it in system prompt
6. AI knows which room it's working on

No guessing, no inference, no hardcoding - just explicit state flow.

