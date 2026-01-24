# Data Restructure Specification

## Overview

This document specifies changes to the database schema and application flow to support:
1. Separated message storage (project-level vs room-level)
2. Project-wide design preferences captured during onboarding
3. Flexible color palette storage per project

---

## Database Schema Changes

### 1. Projects Table - New Columns

Add three free-text columns for global design preferences:

```sql
ALTER TABLE projects ADD COLUMN building_type TEXT;
ALTER TABLE projects ADD COLUMN architecture_style TEXT;
ALTER TABLE projects ADD COLUMN atmosphere TEXT;
```

**Field Descriptions:**
- `building_type`: Type of building (e.g., "residential apartment", "commercial office", "vacation home")
- `architecture_style`: Design style (e.g., "modern minimalist", "mid-century modern", "industrial loft")
- `atmosphere`: Desired mood/feel (e.g., "cozy and warm", "bright and airy", "sophisticated and elegant")

All fields are free-text to allow natural language input. The AI will extract and store appropriate values from conversational responses.

### 2. New Table: color_palette

Flexible color storage with one row per color:

```sql
CREATE TABLE IF NOT EXISTS color_palette (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  hex TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_color_palette_project_id ON color_palette(project_id);
```

**Field Descriptions:**
- `hex`: Color in hex format (e.g., "#3498db")
- `name`: Human-readable color name (e.g., "Ocean Blue", "Warm Terracotta")
- `sort_order`: Display order for the palette (0 = primary, 1 = secondary, etc.)

**Usage:**
- AI interprets natural language color descriptions ("warm earth tones") and creates appropriate hex/name entries
- No limit on number of colors per project
- Sort order allows distinguishing primary/secondary/accent roles without rigid schema

### 3. New Table: room_messages

Per-room message storage with composite key:

```sql
CREATE TABLE IF NOT EXISTS room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_room_messages_project_room ON room_messages(project_id, room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages(room_id);
```

**Field Descriptions:**
- `role`: Message author - 'user' | 'assistant' | 'system'
- `content`: Message text content
- `tool_calls`: JSON array of tool calls made during this message (same format as messages table)

### 4. Messages Table - Clarified Purpose

The existing `messages` table remains for **project-level conversations**:
- Onboarding chat (building type, style, atmosphere, colors questions)
- General project discussions not tied to a specific room
- System messages about project state

Room-specific design conversations go to `room_messages`.

---

## Message Storage Strategy

| Conversation Type | Storage Table | room_id |
|------------------|---------------|---------|
| Onboarding flow | messages | NULL |
| General project chat | messages | NULL |
| Room design chat | room_messages | Required |

---

## Onboarding Flow

### Trigger

Onboarding begins **after** floor plan upload and room detection/manual entry is complete.

**Flow order:**
1. User uploads floor plan
2. System parses and detects rooms (or user enters manually if parsing fails)
3. Onboarding chat begins in `messages` table
4. After onboarding, user proceeds to room-by-room design

### Onboarding Questions

AI asks questions **one at a time** in conversational style:

1. **Building Type**: "What type of building is this?"
   - Examples: residential home, apartment, office, retail space

2. **Architecture Style**: "What architectural style are you going for?"
   - Examples: modern, traditional, Scandinavian, industrial, bohemian

3. **Atmosphere**: "What atmosphere or mood do you want to create?"
   - Examples: cozy, minimalist, luxurious, vibrant, serene

4. **Color Palette**: "What colors would you like to incorporate?"
   - User describes in natural language (e.g., "warm earth tones with navy accents")
   - AI interprets and stores as hex/name pairs in color_palette table

### AI Tool for Updates

The AI uses a tool to update project preferences immediately after each answer:

```typescript
tools: {
  update_project_preferences: {
    description: "Update project design preferences based on user input",
    parameters: {
      building_type: { type: "string", optional: true },
      architecture_style: { type: "string", optional: true },
      atmosphere: { type: "string", optional: true },
      colors: {
        type: "array",
        items: {
          hex: { type: "string" },
          name: { type: "string" }
        },
        optional: true
      }
    }
  }
}
```

**Behavior:**
- AI decides which field(s) to update based on conversation context
- Updates are immediate (persisted even if user abandons session)
- For colors, AI interprets natural language and converts to hex values
- AI acknowledges what it understood: "Great, I've noted that you want a modern minimalist style."

### Preference Editability

All preferences (building_type, architecture_style, atmosphere, colors) remain **always editable** through the preferences dialog. Changes apply to future room designs but don't automatically regenerate existing approved designs.

---

## Room Chat Behavior

### Isolated Threads

Each room has a completely **independent conversation thread**:
- Messages stored in `room_messages` with specific room_id
- AI does not have context from other rooms' conversations
- Global preferences (building_type, style, atmosphere, colors) are injected into AI context for each room

### Room Switching UI

When user switches to a different room:

1. **Display**: Show the room's current state
   - Latest approved/generated image (if any)
   - Room metadata (name, type, dimensions)

2. **History**: Previous messages are accessible but hidden by default
   - "View conversation history" link/button
   - Loads full message history on demand

3. **Input**: Chat input starts fresh
   - User can immediately type new requests
   - AI context includes room data + global preferences (not message history by default)

### Room Context Injection

When AI responds in a room chat, it receives:
- Room geometry (dimensions, shape)
- Doors and windows
- Fixtures
- Adjacent rooms
- **Global preferences**: building_type, architecture_style, atmosphere, color_palette

This ensures design consistency without sharing conversation history.

---

## API Changes

### New Endpoints

```
POST /api/projects/[id]/preferences
  - Update building_type, architecture_style, atmosphere
  - Body: { building_type?, architecture_style?, atmosphere? }

GET /api/projects/[id]/colors
  - Get color palette for project

POST /api/projects/[id]/colors
  - Add colors to palette
  - Body: { colors: [{ hex, name }] }

DELETE /api/projects/[id]/colors/[colorId]
  - Remove a color from palette

GET /api/projects/[id]/rooms/[roomId]/messages
  - Get messages for a specific room
  - Query params: ?limit=20&before=timestamp

POST /api/projects/[id]/rooms/[roomId]/messages
  - Add message to room conversation (via AI SDK)
```

### Modified Endpoints

```
POST /api/chat
  - Now accepts optional room_id parameter
  - If room_id provided: stores in room_messages, loads room context
  - If room_id null: stores in messages (project-level/onboarding)

GET /api/projects/[id]
  - Response now includes: building_type, architecture_style, atmosphere
  - Optionally includes color_palette array
```

---

## UI Changes

### Post-Upload Flow

After `FloorplanUploader` completes (upload + room detection):

1. Transition to onboarding chat view
2. AI sends first message asking about building type
3. User responds naturally
4. AI extracts value, calls `update_project_preferences` tool, acknowledges
5. AI asks next question (architecture style)
6. Repeat for atmosphere and colors
7. After all questions answered, show "proceed to room design" or auto-transition

### Chat Interface Updates

**Room Selector:**
- Shows current room context prominently
- Switching rooms clears chat display, shows room's current image
- "View history" option per room

**Message Display:**
- Project-level messages: shown when no room selected (onboarding, general)
- Room messages: shown when room is selected

**Preferences Panel:**
- Add fields for building_type, architecture_style, atmosphere
- Color palette picker/display
- All fields editable anytime

---

## Implementation Notes

### Database Recreation

**Approach:** Update `lib/db/init.ts` to drop and recreate all tables with the new schema.

This is a **destructive approach** suitable for development. All existing data will be lost.

### Updated init.ts Schema

The `initializeDatabase()` function should create tables in this order:

1. **Drop all existing tables** (in reverse dependency order)
2. **Create tables** with updated schema:
   - `users` - unchanged
   - `projects` - add building_type, architecture_style, atmosphere columns
   - `color_palette` - new table
   - `rooms` - unchanged
   - `room_images` - unchanged
   - `messages` - unchanged (project-level only)
   - `room_messages` - new table
   - `shared_designs` - unchanged

**Complete Schema:**

```sql
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS shared_designs;
DROP TABLE IF EXISTS room_messages;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS room_images;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS color_palette;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

-- Users table (unchanged)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Projects table (NEW COLUMNS: building_type, architecture_style, atmosphere)
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  floor_plan_url TEXT,
  global_preferences TEXT DEFAULT '{}',
  building_type TEXT,
  architecture_style TEXT,
  atmosphere TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Color palette table (NEW)
CREATE TABLE color_palette (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  hex TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Rooms table (unchanged)
CREATE TABLE rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  geometry TEXT DEFAULT '{}',
  doors TEXT DEFAULT '[]',
  windows TEXT DEFAULT '[]',
  fixtures TEXT DEFAULT '[]',
  adjacent_rooms TEXT DEFAULT '[]',
  approved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Room images table (unchanged)
CREATE TABLE room_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  view_type TEXT DEFAULT 'perspective',
  detected_items TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Messages table (unchanged - project-level messages only)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  room_id INTEGER,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
);

-- Room messages table (NEW - per-room messages)
CREATE TABLE room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  room_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- Shared designs table (unchanged)
CREATE TABLE shared_designs (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_color_palette_project_id ON color_palette(project_id);
CREATE INDEX idx_rooms_project_id ON rooms(project_id);
CREATE INDEX idx_room_images_room_id ON room_images(room_id);
CREATE INDEX idx_messages_project_id ON messages(project_id);
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_room_messages_project_room ON room_messages(project_id, room_id);
CREATE INDEX idx_room_messages_room_id ON room_messages(room_id);
CREATE INDEX idx_shared_designs_project_id ON shared_designs(project_id);
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| projects table | +building_type, +architecture_style, +atmosphere columns |
| color_palette table | New table (project_id, hex, name, sort_order) |
| room_messages table | New table (project_id, room_id, role, content, tool_calls) |
| messages table | Clarified: project-level only (onboarding, general chat) |
| Onboarding flow | New chat flow after upload asking 4 questions |
| AI tools | +update_project_preferences tool |
| Room chat | Isolated threads per room, history on-demand |
| Preferences UI | Editable anytime via settings dialog |
