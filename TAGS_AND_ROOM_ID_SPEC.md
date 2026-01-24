# Tags and Room ID Specification

## Overview

This document specifies how **object tags** and **image ID** are handled in the chat system to ensure the AI always knows:
1. Which object the user wants to edit (via tags)
2. Which image the user is currently viewing (via image ID in message)

---

## 1. Object Tags System

### Purpose
Object tags allow users to select a specific object in an image for editing. When an object is clicked, its tag is automatically prepended to the chat input.

### Implementation

#### Tag Format
```
@object-label
```

**Examples:**
- `@armchair`
- `@sofa`
- `@coffee table`

#### Tag Behavior

1. **Single Selection Only**
   - Only ONE object tag can be active at a time
   - Clicking a new object **replaces** the previous tag
   - Tags are NOT stacked

2. **Tag Placement**
   - Tag is automatically prepended to the input field
   - Format: `@object-label ` (with trailing space)
   - User can type after the tag

3. **Tag Removal**
   - Tag is removed when object is deselected
   - Tag is replaced when a different object is selected

#### Code Location
- **Component**: `components/chat/chat-panel.tsx`
- **State**: `selectedObjectTag` prop
- **Handler**: `useEffect` hook (lines 58-117)

#### Example Flow

```
User clicks "armchair" chip
  ↓
selectedObjectTag = "armchair"
  ↓
Input field shows: "@armchair "
  ↓
User types: "make it yellow"
  ↓
Final message: "@armchair make it yellow"
```

---

## 2. Image ID in Messages

### Purpose
The image ID is automatically appended to every chat message so the AI knows which specific image the user is editing.

### Implementation

#### Format
```
[Image ID: {currentImageId}] {user message}
```

**Example:**
```
User types: "make the armchair yellow"
↓
Message sent: "[Image ID: 42] make the armchair yellow"
```

#### When Image ID is Appended

- **Always appended** when `currentImageId` is not null
- **Not appended** when `currentImageId` is null (first image generation)

#### Code Location
- **Component**: `components/chat/chat-panel.tsx`
- **Handler**: `handleSubmit()` function (lines 166-178)

#### Implementation Details

```typescript
const handleSubmit = () => {
  const trimmed = input.trim();
  if (trimmed && !isLoading && !isChatDisabled) {
    // Append image ID to message
    let messageToSend = trimmed;
    if (currentImageId) {
      messageToSend = `[Image ID: ${currentImageId}] ${trimmed}`;
    }
    onSend(messageToSend);
    setInput('');
  }
};
```

---

## 3. Room ID vs Image ID

### Room ID (NOT used in messages)
- **Purpose**: Database identifier for the room
- **Usage**: Used for API calls to fetch room images
- **NOT appended** to chat messages
- **Location**: Stored in `selectedRoomId` (computed from `selectedRoomKey`)

### Image ID (appended to messages)
- **Purpose**: Identifies the specific image being edited
- **Usage**: Appended to every chat message
- **Format**: `[Image ID: X]` prefix
- **Location**: Stored in `currentImageId` state

### Why Image ID, Not Room ID?

1. **Precision**: User edits a specific image, not a room
2. **Context**: AI needs to know which image to edit
3. **Multiple Images**: A room can have multiple images
4. **Editing Target**: Edits apply to a specific image, not the room

---

## 4. Complete Message Flow

### Example 1: Editing an Object

```
1. User views Image ID: 42 (shows armchair)
2. User clicks "armchair" chip
   → selectedObjectTag = "armchair"
   → Input shows: "@armchair "
3. User types: "make it yellow"
4. User presses Enter
   → handleSubmit() called
   → Message becomes: "[Image ID: 42] @armchair make it yellow"
5. Message sent to API
   → Body includes: { currentImageId: 42, selectedObjectId: "obj-123" }
   → Message text: "[Image ID: 42] @armchair make it yellow"
6. AI receives:
   - Image ID in message text
   - currentImageId in request body
   - selectedObjectId in request body
   → AI knows: Edit armchair in Image 42
```

### Example 2: General Room Request

```
1. User views Image ID: 42
2. No object selected
3. User types: "add a lamp"
4. User presses Enter
   → handleSubmit() called
   → Message becomes: "[Image ID: 42] add a lamp"
5. Message sent to API
   → Body includes: { currentImageId: 42, selectedObjectId: null }
   → Message text: "[Image ID: 42] add a lamp"
6. AI receives:
   - Image ID in message text
   - currentImageId in request body
   - No selectedObjectId
   → AI knows: Modify Image 42 (general edit, no specific object)
```

### Example 3: First Image Generation

```
1. No images exist yet (currentImageId = null)
2. User types: "create a modern living room"
3. User presses Enter
   → handleSubmit() called
   → Message becomes: "create a modern living room" (no Image ID)
4. Message sent to API
   → Body includes: { currentImageId: null }
   → Message text: "create a modern living room"
5. AI receives:
   - No Image ID in message (null currentImageId)
   - No selectedObjectId
   → AI knows: Generate new image
```

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ User Interface                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Image Viewer                                                │
│  ┌─────────────────┐                                         │
│  │ [Image ID: 42]  │ ← currentImageId state                 │
│  │                 │                                         │
│  │ [armchair] [sofa] ← Object chips                         │
│  └─────────────────┘                                         │
│         ↓                                                    │
│  User clicks "armchair"                                      │
│         ↓                                                    │
│  selectedObjectTag = "armchair"                              │
│         ↓                                                    │
│  Chat Input: "@armchair "                                    │
│         ↓                                                    │
│  User types: "make it yellow"                                │
│         ↓                                                    │
│  handleSubmit()                                              │
│         ↓                                                    │
└─────────┼───────────────────────────────────────────────────┘
          │
          │ Message: "[Image ID: 42] @armchair make it yellow"
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│ Chat API Request                                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Request Body:                                                │
│  {                                                           │
│    "currentImageId": 42,                                     │
│    "selectedObjectId": "obj-123",                           │
│    "roomKey": "living-room-1",                              │
│    "messages": [                                             │
│      {                                                       │
│        "role": "user",                                       │
│        "content": "[Image ID: 42] @armchair make it yellow" │
│      }                                                       │
│    ]                                                         │
│  }                                                           │
│                                                               │
│  AI System Prompt:                                           │
│  - Room context: "Living Room 1"                            │
│  - Image context: "Image ID: 42"                            │
│  - Selected object: "armchair (obj-123)"                    │
│  - Available objects: [armchair, sofa, ...]                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Key Invariants

### Must Always Hold

1. **Object Tag Uniqueness**
   - ✅ Only ONE object tag can be active
   - ❌ Multiple tags cannot be stacked

2. **Image ID Presence**
   - ✅ Image ID appended when `currentImageId !== null`
   - ❌ Image ID NOT appended when `currentImageId === null`

3. **Tag Replacement**
   - ✅ New object selection replaces previous tag
   - ❌ Previous tag is NOT preserved

4. **Message Format**
   - ✅ Format: `[Image ID: X] @object user text`
   - ✅ Image ID always first (if present)
   - ✅ Object tag after Image ID (if present)
   - ✅ User text last

---

## 7. Component Responsibilities

### `ChatPanel` (`components/chat/chat-panel.tsx`)

**Responsibilities:**
- Display object tags in input field
- Append image ID to messages
- Handle tag replacement logic
- Validate message before sending

**Props:**
- `selectedObjectTag?: string | null` - Object tag to display
- `currentImageId?: number | null` - Image ID to append

**Key Functions:**
- `handleSubmit()` - Appends image ID, sends message
- `useEffect` (lines 58-117) - Manages tag display/replacement

### `ChatWrapper` (`components/chat/chat-wrapper.tsx`)

**Responsibilities:**
- Pass `currentImageId` to `ChatPanel`
- Pass `selectedObjectLabel` as `selectedObjectTag`
- Manage chat state

**Props:**
- `currentImageId: number | null` - Current image ID
- `selectedObjectLabel?: string | null` - Object label for tag

### `ProjectPage` (`app/(dashboard)/project/[id]/page.tsx`)

**Responsibilities:**
- Maintain `currentImageId` state
- Maintain `selectedObject` state
- Pass props to `ChatWrapper`

**State:**
- `currentImageId: number | null` - Currently viewed image
- `selectedObject: { id: string; label: string } | null` - Selected object

---

## 8. API Contract

### Request Body Structure

```typescript
{
  projectId: number;
  roomKey: string;              // e.g., "living-room-1"
  currentImageId: number | null; // Image being edited
  selectedObjectId: string | null; // Object being edited
  messages: Array<{
    role: "user" | "assistant";
    content: string; // User messages include "[Image ID: X] @object text"
  }>;
}
```

### Message Content Format

**User Message Examples:**
```
"[Image ID: 42] @armchair make it yellow"
"[Image ID: 42] add a lamp"
"create a modern living room" // No Image ID (first generation)
```

**Assistant Messages:**
```
"I'll make the armchair yellow for you!"
"Adding a lamp to your living room..."
```

---

## 9. Edge Cases

### Case 1: Object Selected, No Image
- **Scenario**: User selects object but `currentImageId` is null
- **Behavior**: Chat input is disabled
- **Reason**: Cannot edit object without an image

### Case 2: Image Selected, No Object
- **Scenario**: User has image but no object selected
- **Behavior**: Message sent with Image ID, no object tag
- **Example**: `"[Image ID: 42] add a lamp"`

### Case 3: Multiple Objects of Same Type
- **Scenario**: Image has multiple "armchair" objects
- **Behavior**: `selectedObjectId` distinguishes them
- **Tag**: Still shows `@armchair` (label only)
- **Backend**: Uses `selectedObjectId` to find correct object

### Case 4: Tag Removed Mid-Typing
- **Scenario**: User types with tag, then deselects object
- **Behavior**: Tag is removed from input, user text preserved
- **Example**: `"@armchair make it"` → object deselected → `"make it"`

---

## 10. Testing Checklist

### Object Tags
- [ ] Clicking object adds tag to input
- [ ] Clicking different object replaces tag
- [ ] Deselecting object removes tag
- [ ] Only one tag active at a time
- [ ] Tag appears before user text

### Image ID
- [ ] Image ID appended when `currentImageId` is set
- [ ] Image ID NOT appended when `currentImageId` is null
- [ ] Image ID format: `[Image ID: X]`
- [ ] Image ID appears before object tag
- [ ] Image ID appears before user text

### Combined
- [ ] Message format: `[Image ID: X] @object user text`
- [ ] Message format: `[Image ID: X] user text` (no object)
- [ ] Message format: `user text` (no image, no object)
- [ ] API receives correct `currentImageId`
- [ ] API receives correct `selectedObjectId`

---

## 11. Future Enhancements

### Potential Improvements

1. **Room ID in Messages** (if needed)
   - Could append: `[Room ID: X] [Image ID: Y] @object text`
   - Currently not needed (room context in system prompt)

2. **Tag Formatting**
   - Could make tags clickable to remove
   - Could show tag count if multiple objects selected

3. **Image ID Display**
   - Could show image ID in UI (currently only in message)
   - Could show image thumbnail in chat

---

## Summary

**Object Tags:**
- Format: `@object-label`
- Behavior: Single selection, auto-replace
- Purpose: Identify object to edit

**Image ID:**
- Format: `[Image ID: X]`
- Behavior: Auto-appended to messages
- Purpose: Identify image to edit

**Combined Message Format:**
```
[Image ID: {id}] @{object} {user text}
```

This ensures the AI always knows:
1. **Which image** (from Image ID)
2. **Which object** (from tag + selectedObjectId)
3. **What to do** (from user text)

