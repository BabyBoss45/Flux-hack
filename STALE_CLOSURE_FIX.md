# Stale Closure Fix - Request Body Always Fresh

## Root Cause

The chat request was sending stale `roomId` and `currentImageId` values because of a **stale closure** in the transport initialization.

### The Problem

```typescript
// ❌ OLD CODE - Body captured at construction time
const chat = useAIChat({
  transport: new ImageAwareChatTransport({
    api: '/api/chat',
    body: {
      projectId,
      roomId,        // ← Captured once, never updates
      currentImageId, // ← Captured once, never updates
    },
  }),
});
```

**What happened:**
1. `ImageAwareChatTransport` constructor captured the `body` object at initialization
2. When `roomId` or `currentImageId` changed in UI state, the transport still used the old values
3. This created a closure that "froze" the initial values
4. Result: Chat kept sending old `roomId` (e.g., room-8) even after user selected a different room

### Why It Failed

React closures capture values at the time of creation. When the transport was created:
- It captured `roomId = 8` (initial value)
- Even when UI updated to `roomId = 5`, the transport still used `8`
- The `body` object was static, not reactive

## The Fix

### Solution: Ref-Based Request Body

```typescript
// ✅ NEW CODE - Body built at request time from ref
const requestBodyRef = useRef({ projectId, roomId, selectedObjectId, currentImageId });

// Update ref whenever props change
useEffect(() => {
  requestBodyRef.current = { projectId, roomId, selectedObjectId, currentImageId };
}, [projectId, roomId, selectedObjectId, currentImageId]);

// Build body function that reads from ref
const getBody = () => requestBodyRef.current;

// Transport injects body at request time (not construction time)
class ImageAwareChatTransport extends DefaultChatTransport {
  fetch: async (input, init) => {
    const dynamicBody = getBodyRef(); // ← Called at request time
    // Merge with request body
    const mergedBody = { ...requestBody, ...dynamicBody };
    // Send with fresh values
  }
}
```

### Key Changes

1. **Ref Storage**: Store latest values in `useRef` (always current)
2. **Effect Update**: Update ref synchronously when props change
3. **Request-Time Injection**: Build body at request time, not construction time
4. **Fetch Override**: Intercept fetch to inject fresh body values

## Implementation Details

### 1. Ref-Based State (`hooks/use-chat.ts`)

```typescript
const requestBodyRef = useRef({
  projectId,
  roomId,
  selectedObjectId,
  currentImageId,
});

// Update ref when props change
useEffect(() => {
  requestBodyRef.current = {
    projectId,
    roomId,
    selectedObjectId,
    currentImageId,
  };
}, [projectId, roomId, selectedObjectId, currentImageId]);
```

### 2. Dynamic Body Builder

```typescript
const getBody = () => {
  return {
    projectId: requestBodyRef.current.projectId,
    roomId: requestBodyRef.current.roomId,
    selectedObjectId: requestBodyRef.current.selectedObjectId,
    currentImageId: requestBodyRef.current.currentImageId,
  };
};
```

### 3. Transport Fetch Override

```typescript
fetch: async (input, init) => {
  // Get fresh body at request time
  const dynamicBody = getBodyRef();
  
  // Merge with existing body
  const mergedBody = {
    ...requestBody,
    ...dynamicBody, // ← Overwrites stale values
  };
  
  // Send with fresh values
  return originalFetch(input, { ...init, body: JSON.stringify(mergedBody) });
}
```

## Backend Validation

### Hard-Require currentImageId

```typescript
// ✅ NEW: Reject if images exist but currentImageId is null
const existingImages = getRoomImagesByRoomId(Number(roomId));
if (existingImages.length > 0 && (currentImageId === null || currentImageId === undefined)) {
  return new Response('Please select an image to continue.', { status: 400 });
}
```

**No fallback logic:**
- ❌ Removed: `currentImageId || getLatestImage()`
- ❌ Removed: `currentImageId || existingImages[0]`
- ✅ Only: `currentImageId` or reject

## Data Flow (Fixed)

```
UI State Changes
    ↓
useEffect updates requestBodyRef.current
    ↓
User sends message
    ↓
getBody() reads from requestBodyRef.current (fresh values)
    ↓
Transport fetch() injects fresh body
    ↓
API receives current roomId and currentImageId
```

## Verification

Check console logs:
- `[USE CHAT] Request body ref updated: { roomId: X, currentImageId: Y }`
- `[USE CHAT] Building request body at send time: { roomId: X, currentImageId: Y }`
- `[TRANSPORT] Injected dynamic body: { roomId: X, currentImageId: Y }`
- `[CHAT API] Extracted - Room ID: X, Current Image ID: Y`

All should show the **current** values, not stale ones.

## Summary

**Root Cause:** Stale closure - body captured at transport construction time  
**Fix:** Ref-based body built at request time  
**Result:** Always sends latest `roomId` and `currentImageId` from UI state

