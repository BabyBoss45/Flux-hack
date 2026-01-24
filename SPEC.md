# AI Interior Design Chat Interface

## Overview

A conversational AI-powered interior design tool that transforms floor plans into photorealistic room visualizations. Users upload a PDF floor plan, the system automatically detects rooms, and an AI agent guides them through designing each room via natural conversation.

## Tech Stack

- **Framework:** Next.js (App Router)
- **AI:** Vercel AI SDK with tool calling
- **Image Generation:** BFL Flux 2 API (text-to-image, image editing)
- **Database:** SQLite
- **Styling:** Tailwind CSS + shadcn/ui
- **Auth:** Mock authentication (fake login form accepts any credentials)

---

## Core User Flow

```
1. Upload PDF floor plan
        ↓
2. Auto-detect rooms via API (fallback: manual entry)
        ↓
3. Set global design preferences (style, colors, budget)
        ↓
4. Per-room design conversation with AI
        ↓
5. Explicit approval per room before next
        ↓
6. Generate shareable design (UUID)


```

Color Palette for Interior Design App

Primary Colors
Name: Sage
Hex: #627362
Usage: Primary actions, buttons, links - sophisticated & natural
────────────────────────────────────────
Name: Terracotta
Hex: #e2704d
Usage: Accent highlights, approval states, CTAs
────────────────────────────────────────
Name: Sand
Hex: #e6e2d8
Usage: Secondary surfaces, subtle backgrounds
────────────────────────────────────────
Name: Charcoal
Hex: #3d3d3d
Usage: Text, dark mode backgrounds
Extended Palettes

Sage (50-950) - Primary brand color, natural and calming

- Light: #f6f7f6 → Dark: #181c18

Terracotta (50-950) - Warm accent for engagement

- Light: #fdf6f3 → Dark: #40180f

Sand (50-950) - Neutral backgrounds that let room images shine

- Light: #faf9f7 → Dark: #302a24

Design Rationale

- Warm neutrals let generated room images be the focal point
- Sage green feels natural and connects to home/interior themes
- Terracotta adds warmth without competing with room renders
- High contrast maintained for accessibility in both light/dark modes

---

## Features

### 1. Floor Plan Upload & Parsing

**Upload:**

- Accept PDF files containing floor plans
- Display upload progress and parsing status

**Auto-Detection API Response:**

```json
{
  "confidence_level": "high|medium|low",
  "total_rooms": 3,
  "rooms": [
    {
      "id": "room_001",
      "name": "Living Room",
      "type": "living_area",
      "geometry": {
        "length_m": 5.5,
        "width_m": 4.2,
        "area_sqm": 23.1
      },
      "doors": [{ "position": "north", "target_room": "hallway" }],
      "windows": [{ "position": "east", "count": 2 }],
      "fixtures": ["sofa"],
      "adjacent_rooms": ["hallway", "kitchen"]
    }
  ]
}
```

**Parsing:**

- External floor plan parsing API (endpoint TBD)
- Returns structured room data as shown above

**Fallback:**

- If parsing fails or returns low confidence, allow manual room entry
- User can input room names, types, and basic dimensions

### 2. Global Design Preferences

Before starting room design, user sets project-wide preferences:

- **Style:** Modern, Traditional, Scandinavian, Industrial, etc.
- **Color Palette:** Primary/accent colors or predefined palettes
- **Budget Tier:** Economy, Mid-range, Luxury (influences furniture suggestions)

These apply to all rooms unless overridden in conversation.

**Storage:** JSON blob in `projects.global_preferences` column containing:

```json
{
  "style": "modern",
  "color_palette": ["#ffffff", "#2c3e50", "#e74c3c"],
  "budget_tier": "mid-range"
}
```

### 3. Chat Interface

**Structure:**

- Single unified conversation thread for entire project
- Room tabs/filters to view room-specific sections
- Images displayed inline within chat messages

**AI Agent:**

- Powered by Vercel AI SDK
- Full access to structured room data (geometry, windows, doors, adjacency)
- Uses room context to craft spatially-accurate image prompts
- Direct tool calling to BFL APIs

**Agent Tools:**

```typescript
tools: {
  generate_room_image: {
    // Calls BFL Flux 2 text-to-image
    // Uses room geometry + user preferences + conversation context
    // Returns image URL + detected items list
  },
  edit_room_image: {
    // Calls BFL Flux 2 image editing
    // Text-based edit instructions (no mask drawing)
    // Returns updated image URL + refreshed items list
  },
  scan_image_items: {
    // AI vision analyzes image
    // Returns list of detected furniture/fixtures/decor
  },
  approve_room: {
    // Marks room as complete, enables progression
  },
  get_room_context: {
    // Retrieves full room data for AI context
  }
}
```

### 4. Image Generation

> Use prompt enhancing https://docs.bfl.ai/guides/prompting_summary

**Text-to-Image (BFL Flux 2):**

- API: `https://docs.bfl.ai/flux_2/flux2_text_to_image`
- Resolution: 1920x1080 (16:9 landscape)
- Prompt construction includes:
  - Room dimensions and shape
  - Window/door positions
  - User style preferences
  - Specific furniture/decor requests from chat

**Image Editing (BFL Flux 2):**

- API: `https://docs.bfl.ai/flux_2/flux2_image_editing`
- Text-description only (no mask drawing UI)
- User describes changes in natural language
- AI determines edit region from description

**Item Detection & Editing:**

- AI agent uses vision capabilities to scan generated images
- Returns list of detected items (furniture, fixtures, decor)
- Items displayed as text list below image with edit buttons
- Clicking edit button opens modal dialog:
  - Shows item name
  - Text input for edit instruction
  - Submit triggers `edit_room_image` tool with item-specific prompt

### 5. Per-Room State

**State Model:**

```typescript
interface RoomState {
  id: string;
  name: string;
  type: string;
  geometry: RoomGeometry;
  doors: Door[];
  windows: Window[];
  fixtures: string[];
  adjacent_rooms: string[];

  // Design state
  images: RoomImage[]; // Multiple views allowed
  approved: boolean;
  preferences_override?: Partial<GlobalPreferences>;
}

interface RoomImage {
  id: string;
  url: string;
  prompt: string;
  created_at: Date;
  view_type?: string; // "main", "alternate_angle", "variation"
}
```

**Key Behaviors:**

- Latest state only (no version history)
- Multiple images/views allowed per room
- Explicit approval required before moving to next room

### 6. Room Progression

- AI guides user through rooms sequentially
- User must explicitly approve each room's design
- Approval unlocks next room in sequence
- User can revisit approved rooms to make changes

### 7. Shareable Design

**Generation:**

- Triggered after all rooms are approved
- Creates unique UUID for the design
- Permanent link (no expiry)

**Shared View Includes:**

- All generated room images
- Original floor plan
- Room specifications (dimensions, features)
- Key design decisions from conversation

**URL Format:** `/share/{uuid}`

---

## Data Model

### Database Schema (SQLite)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT,
  floor_plan_url TEXT,
  global_preferences JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rooms
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT,
  geometry JSON,
  doors JSON,
  windows JSON,
  fixtures JSON,
  adjacent_rooms JSON,
  approved BOOLEAN DEFAULT FALSE,
  preferences_override JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Room Images
CREATE TABLE room_images (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  url TEXT NOT NULL,
  prompt TEXT,
  view_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Chat Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  room_id TEXT,  -- nullable, for room-specific filtering
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  tool_calls JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Shared Designs
CREATE TABLE shared_designs (
  id TEXT PRIMARY KEY,  -- UUID
  project_id TEXT NOT NULL REFERENCES projects(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Routes

### Floor Plan

- `POST /api/floor-plan/upload` - Upload PDF, trigger parsing
- `POST /api/floor-plan/parse` - Auto-detect rooms from PDF

### Projects

- `POST /api/projects` - Create new project
- `GET /api/projects` - List user's projects
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project (preferences)

### Rooms

- `GET /api/projects/[id]/rooms` - Get all rooms for project
- `PATCH /api/rooms/[id]` - Update room state
- `POST /api/rooms/[id]/approve` - Mark room as approved

### Chat

- `POST /api/chat` - Vercel AI chat endpoint with tool calling

### Images (BFL Integration)

- `POST /api/images/generate` - Text-to-image via BFL Flux 2
- `POST /api/images/edit` - Image editing via BFL Flux 2

### Share

- `POST /api/share` - Generate shareable design link
- `GET /api/share/[uuid]` - Get shared design data (public)

---

## UI Components

### Pages

- `/` - Landing page
- `/login`, `/register` - Auth pages
- `/dashboard` - Project list
- `/project/[id]` - Main design interface
- `/share/[uuid]` - Public shared design view

### Main Design Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Project Name | Global Preferences | Share Button   │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│  Room List  │              Chat Interface                   │
│  (sidebar)  │                                               │
│             │  ┌─────────────────────────────────────────┐  │
│  □ Living   │  │  [AI]: Here's your living room design  │  │
│  ■ Bedroom  │  │  [IMAGE]                                │  │
│  □ Kitchen  │  │  Detected items:                        │  │
│  □ Bathroom │  │  [Sofa ✏️] [Coffee Table ✏️] [Lamp ✏️]  │  │
│             │  │                                         │  │
│  [Floor     │  │  [User]: Can you change the sofa to    │  │
│   Plan      │  │  blue velvet?                           │  │
│   Preview]  │  │                                         │  │
│             │  │  [AI]: Here's the updated design...    │  │
│             │  │  [IMAGE]                                │  │
│             │  │  Detected items:                        │  │
│             │  │  [Sofa ✏️] [Coffee Table ✏️] [Lamp ✏️]  │  │
│             │  └─────────────────────────────────────────┘  │
│             │                                               │
│             │  ┌─────────────────────────────────────────┐  │
│             │  │  [Input field]              [Send]      │  │
│             │  └─────────────────────────────────────────┘  │
└─────────────┴───────────────────────────────────────────────┘
```

### Key Components (shadcn/ui based)

- `FloorPlanUploader` - PDF upload with drag-drop
- `RoomSidebar` - Room list with approval status
- `ChatInterface` - Message list with inline images
- `ChatInput` - Text input with send button
- `ChatImage` - Image with detected items list below
- `ItemEditDialog` - Modal for editing specific item (item name + text input)
- `RoomImageViewer` - Full-size image view with gallery
- `PreferencesDialog` - Global style/color/budget settings
- `ShareDialog` - Generate and copy share link
- `ManualRoomEntry` - Form for fallback room input
- `LoadingSpinner` - BFL job polling indicator

---

## External API Integration

### BFL Flux 2 Text-to-Image

```typescript
// POST https://api.bfl.ai/v1/flux2/text-to-image
interface GenerateRequest {
  prompt: string;
  width: 1920;
  height: 1080;
  // Additional params per BFL docs
}
```

### BFL Flux 2 Image Editing

```typescript
// POST https://api.bfl.ai/v1/flux2/edit
interface EditRequest {
  image_url: string;
  prompt: string; // Edit instruction
  // Additional params per BFL docs
}
```

### BFL Async Pattern

Image generation is asynchronous:

1. Submit job → receive `job_id`
2. Poll status endpoint every 2-3 seconds
3. On completion, retrieve image URL
4. Show loading spinner in UI during polling

---

## Environment Variables

```env
# Database
DATABASE_URL=

# BFL API
BFL_API_KEY=

# AI
ANTHROPIC_API_KEY=  # or ANTHROPIC_API_KEY for Claude

# Storage (for images/PDFs) S3 public
BLOB_STORAGE_URL=
```

---

## Non-Functional Requirements

- **Image Storage:** Generated images stored in blob storage (S3 storage)
- **Response Time:** Image generation 10-30s; polling with loading spinner
- **Error Handling:** Graceful failures with retry options
- **Mobile:** Responsive design, but optimized for desktop

---

## Out of Scope (V1)

- Real-time collaboration
- AR/VR room preview
- Furniture purchasing integration
- Cost estimation
- Version history / undo
- Mask-based image editing
- Multiple projects per share link
