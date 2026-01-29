# AI Interior Design Chat Interface

## Overview

A conversational AI-powered interior design tool that transforms floor plans into photorealistic room visualizations. Users upload a PDF floor plan, the system automatically detects rooms via AI analysis, and an AI agent guides them through designing each room via natural conversation.

## Tech Stack

### Frontend & Backend (Next.js)

- **Framework:** Next.js 16+ (App Router)
- **React:** 19+
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix UI primitives)
- **Database:** SQLite via better-sqlite3
- **AI SDK:** Vercel AI SDK with Anthropic adapter
- **Image Processing:** Sharp
- **PDF Generation:** jsPDF
- **Validation:** Zod

### Python LLM Service

- **Framework:** FastAPI
- **AI:** Anthropic Claude
- **Floor Plan Analysis:** RasterScan API integration
- **Package Manager:** UV

### External Services

- **AI Chat:** Anthropic Claude (claude-sonnet-4-20250514) - fixed, 5 tool execution rounds max
- **Image Generation:** Runware API
- **Floor Plan Analysis:** RasterScan API

---

## Color Palette

### Primary Colors

| Name       | Hex     | Usage                                                     |
| ---------- | ------- | --------------------------------------------------------- |
| Sage       | #627362 | Primary actions, buttons, links - sophisticated & natural |
| Terracotta | #e2704d | Accent highlights, approval states, CTAs                  |
| Sand       | #e6e2d8 | Secondary surfaces, subtle backgrounds                    |
| Charcoal   | #3d3d3d | Text, dark mode backgrounds                               |

### Extended Palettes

- **Sage (50-950):** Light #f6f7f6 → Dark #181c18
- **Terracotta (50-950):** Light #fdf6f3 → Dark #40180f
- **Sand (50-950):** Light #faf9f7 → Dark #302a24

### Design Rationale

- Warm neutrals let generated room images be the focal point
- Sage green feels natural and connects to home/interior themes
- Terracotta adds warmth without competing with room renders
- High contrast maintained for accessibility in both light/dark modes

---

## Core User Flow

```
1. Landing Page (unauthenticated) or Dashboard (authenticated)
        ↓
2. Create New Project
        ↓
3. STEP 1: Upload floor plan + Set global preferences
   - Upload PDF/PNG/JPEG floor plan
   - AI analyzes and detects rooms (RasterScan + Claude)
   - Generates annotated floor plan with colored room overlays (required)
   - Set building type, architecture style, atmosphere
   - Configure color palette (set-and-forget)
   - If analysis fails → Manual room entry fallback
        ↓
4. STEP 2: Per-room design with AI
   - AI auto-generates initial design based on preferences
   - User refines via natural conversation
   - Klein system handles image edits with ambiguity detection (chat clarification)
   - Object detection with precision focus
   - Select final image (hero for sharing)
   - Explicit approval required to progress
        ↓
5. STEP 3: Finalize
   - Product search for detected items (pluggable interface)
   - Review all approved rooms
   - Generate shareable design (UUID)
        ↓
6. Share view (final images only)
```

**Workflow Navigation:** Freely navigable - users can jump between steps at any time after initial completion. Changes cascade forward (e.g., preference changes warn and offer to regenerate affected rooms).

---

## Features

### 1. Floor Plan Upload & Analysis

**Upload:**

- Accept PDF, PNG, JPEG files containing floor plans
- Display upload progress via Server-Sent Events (SSE)
- Maximum file size: configurable (recommended 10MB)

**AI Analysis Pipeline:**

1. Upload file to storage
2. Send to Python LLM service
3. RasterScan API processes floor plan image
4. Claude analyzes results and extracts room data
5. Generate annotated floor plan with colored room overlays (required output)
6. Return structured room data

**Analysis Response:**

```json
{
  "confidence_level": "high|medium|low",
  "total_rooms": 3,
  "annotated_floor_plan_url": "https://storage.example.com/annotated/abc123.png",
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

**Fallback:**

- If RasterScan is unavailable or returns poor results → Manual room entry only
- User inputs room names, types, and basic dimensions via form

### 2. Global Design Preferences

Before starting room design, user sets project-wide preferences via the Design Brief Wizard:

| Preference         | Storage         | Description                                         |
| ------------------ | --------------- | --------------------------------------------------- |
| Building Type      | Column          | Residential, Commercial, etc.                       |
| Architecture Style | Column          | Modern, Traditional, Scandinavian, Industrial, etc. |
| Atmosphere         | Column          | Cozy, Minimalist, Luxurious, etc.                   |
| Color Palette      | Separate table  | User-defined colors with sort order                 |
| Custom Constraints | Column (future) | Free-text notes and requirements                    |

**Preference Change Behavior:** If preferences change after rooms are designed, warn user and offer to regenerate affected rooms.

**Storage:** All core preferences as explicit database columns (migrate away from JSON blob).

### 3. Chat Interface

**Structure:**

- Per-room conversation threads stored in `room_messages` table
- Project-level messages in `messages` table for global design discussion
- Images displayed inline within chat messages
- Object detection results shown below images

**AI Configuration:**

- Model: Claude claude-sonnet-4-20250514 (claude-sonnet-4-20250514) - fixed
- Max tool execution rounds: 5 per message - fixed
- Streaming responses via Vercel AI SDK

**Initial Room Behavior:**

- AI auto-generates initial design when user enters a room
- Uses room geometry + global preferences to craft prompt
- User can then refine via conversation

**Agent Tools:**

```typescript
tools: {
  generate_room_image: {
    // Calls Runware text-to-image API
    // Uses room geometry + user preferences + conversation context
    // Resolution: 1920x1080 (16:9 landscape) - fixed
    // Returns image URL + detected items list
  },
  edit_room_image: {
    // Calls Runware image editing API
    // Routed through Klein system for intent parsing
    // Returns updated image URL + refreshed items list
  },
  scan_image_items: {
    // AI vision analyzes image
    // Precision over recall: better to miss items than false detect
    // Returns list of detected furniture/fixtures/decor
  },
  approve_room: {
    // Marks room as complete
    // Requires explicit user action (approve button)
  },
  get_room_context: {
    // Retrieves full room data for AI context
  }
}
```

### 4. Klein System (Image Manipulation)

Klein is a specialized subsystem for parsing and executing image edit intents.

**Components:**

- **Parser:** Extracts edit intent from natural language
- **Task Builder:** Constructs Runware API requests
- **Ambiguity Detector:** Identifies unclear references (e.g., "the chair" when multiple exist)
- **Constraint Validator:** Ensures edits are feasible

**Ambiguity Handling:**

- When ambiguity detected, AI asks for clarification in chat thread
- User responds with clarification before edit proceeds

### 5. Image Generation

**Provider:** Runware API (permanent)

**Text-to-Image:**

- Resolution: 1920x1080 (16:9 landscape) - only supported format
- Prompt construction includes:
  - Room dimensions and shape
  - Window/door positions
  - User style preferences (building type, architecture style, atmosphere)
  - Color palette
  - Specific requests from conversation

**Image Editing:**

- Text-description only (no mask drawing UI)
- User describes changes in natural language
- Klein system parses intent and determines edit parameters

**Object Detection:**

- AI vision analyzes generated images
- Prioritize precision over recall (fewer false positives)
- Returns list of detected items (furniture, fixtures, decor)
- Items displayed as clickable list below image

**Async Pattern:**

1. Submit job → receive `job_id`
2. Poll status endpoint with SSE streaming
3. On completion, retrieve image URL
4. Show loading spinner during generation

### 6. Per-Room State

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
  images: RoomImage[];
  approved: boolean;
}

interface RoomImage {
  id: string;
  url: string;
  prompt: string;
  detected_items: DetectedItem[];
  is_final: boolean; // Hero image for sharing
  created_at: Date;
  view_type?: string;
}
```

**Key Behaviors:**

- Latest state only (no version history)
- Multiple images allowed per room
- `is_final` marks the hero image shown in share view
- Explicit approval required via approve button (separate from final selection)

### 7. Room Progression

- AI auto-generates initial design when user enters room
- User refines design through conversation
- User selects final (hero) image
- User clicks explicit "Approve" button to confirm
- Approval enables progression indicator but navigation is free
- User can revisit any room at any time

### 8. Product Search (Finalize Step)

**Scope:** Product search only - no purchasing integration

**Interface:** Pluggable - specific product APIs are implementation details

```typescript
interface ProductSearchProvider {
  searchByItem(item: DetectedItem): Promise<ProductResult[]>;
}

interface ProductResult {
  name: string;
  description: string;
  imageUrl: string;
  searchQuery: string; // For user to search on external sites
  estimatedPriceRange?: string;
}
```

**UX:** Display detected items from final room images with similar product suggestions. Users search for products externally.

### 9. Shareable Design

**Generation:**

- Triggered from finalize step
- Creates unique UUID for the design
- Permanent link (no expiry)

**Shared View Content:**

- Final (hero) images only - no iteration history
- Original floor plan + annotated version
- Room specifications (dimensions, features)
- Building type, architecture style, atmosphere

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
  annotated_floor_plan_url TEXT,  -- Required output from analysis
  -- Explicit preference columns (not JSON blob)
  building_type TEXT,
  architecture_style TEXT,
  atmosphere TEXT,
  custom_constraints TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Color Palette (separate table, set-and-forget)
CREATE TABLE color_palette (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  hex TEXT NOT NULL,
  name TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Room Images
CREATE TABLE room_images (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  url TEXT NOT NULL,
  prompt TEXT,
  view_type TEXT,
  detected_items JSON,
  is_final BOOLEAN DEFAULT FALSE,  -- Hero image for sharing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project-level Messages (global design discussion)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  room_id TEXT,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  tool_calls JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Room-level Messages (per-room conversations)
CREATE TABLE room_messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  room_id TEXT NOT NULL REFERENCES rooms(id),
  role TEXT NOT NULL,
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

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/register` - User registration

> **TODO:** Current implementation is mock authentication (accepts any credentials). Real authentication system required for production.

### Floor Plan

- `POST /api/floor-plan/upload-and-analyse` - Upload + AI analysis (SSE streaming)
- `GET /api/floor-plan/health` - LLM service health check

### Projects

- `POST /api/projects` - Create new project
- `GET /api/projects` - List user's projects
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project
- `PATCH /api/projects/[id]/preferences` - Update preferences

### Color Palette

- `GET /api/projects/[id]/colors` - Get project colors
- `POST /api/projects/[id]/colors` - Add color
- `DELETE /api/projects/[id]/colors/[colorId]` - Remove color

### Rooms

- `GET /api/projects/[id]/rooms` - Get all rooms for project
- `POST /api/projects/[id]/rooms` - Create room (manual entry)
- `GET /api/rooms/[id]` - Get room details
- `PATCH /api/rooms/[id]` - Update room
- `DELETE /api/rooms/[id]` - Delete room
- `POST /api/rooms/[id]/approve` - Mark room as approved

### Room Images

- `GET /api/rooms/[id]/images` - Get room images
- `POST /api/rooms/[id]/images` - Add image to room
- `POST /api/rooms/[id]/images/[imageId]/save-final` - Mark image as final

### Chat

- `POST /api/chat` - Vercel AI chat endpoint with streaming + tool calling

### Image Generation (Runware)

- `POST /api/images/generate` - Text-to-image
- `POST /api/images/edit` - Image editing
- `GET /api/images/status/[jobId]` - Check job status

### Klein

- `POST /api/klein/generate` - Klein-based image generation with intent parsing

### Product Search

- `POST /api/llm/analyze-and-shop` - Analyze image + find similar products

### Share

- `POST /api/share` - Generate shareable design link
- `GET /api/share/[uuid]` - Get shared design data (public)

### Utilities

- `GET /api/health` - App health check
- `GET /api/uploads/[...path]` - Serve uploaded files

---

## Python LLM Service

### Overview

Separate FastAPI microservice handling floor plan analysis and product search.

**Location:** `/LLM/` directory

### Endpoints

| Endpoint              | Method | Purpose                      |
| --------------------- | ------ | ---------------------------- |
| `/health`             | GET    | Service health check         |
| `/analyze-floor-plan` | POST   | RasterScan + Claude analysis |
| `/search-products`    | POST   | Product search by item       |

### Floor Plan Analysis Flow

1. Receive floor plan image
2. Send to RasterScan API for initial processing
3. Pass results to Claude for room extraction
4. Generate annotated floor plan with colored overlays
5. Return structured room data + annotated image URL

### Deployment

- Runs as separate Docker container
- Communicates with Next.js app via HTTP
- Requires: `ANTHROPIC_API_KEY`, `RASTERSCAN_API_KEY`

---

## UI Structure

### Pages

| Route                    | Description                              |
| ------------------------ | ---------------------------------------- |
| `/`                      | Marketing landing page (unauthenticated) |
| `/login`, `/register`    | Auth pages                               |
| `/dashboard`             | Project list (authenticated)             |
| `/project/new`           | Create new project                       |
| `/project/[id]`          | Main 3-step design interface             |
| `/project/[id]/finalize` | Finalize + product search                |
| `/share/[uuid]`          | Public shared design view                |

### Main Design Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Project Name | Step Indicator (1-2-3) | Share      │
├─────────────┬───────────────────────────────────────────────┤
│             │                                               │
│  Room List  │              Chat Interface                   │
│  (sidebar)  │                                               │
│             │  ┌─────────────────────────────────────────┐  │
│  ✓ Living   │  │  [AI]: Here's your initial design      │  │
│  ● Bedroom  │  │  [IMAGE]                                │  │
│  ○ Kitchen  │  │  Detected items:                        │  │
│  ○ Bathroom │  │  [Sofa] [Coffee Table] [Lamp]           │  │
│             │  │                                         │  │
│  [Floor     │  │  [User]: Change the sofa to blue velvet │  │
│   Plan      │  │                                         │  │
│   Preview]  │  │  [AI]: I'll update that for you...     │  │
│             │  │  [IMAGE]                                │  │
│  [Annotated │  │                                         │  │
│   View]     │  └─────────────────────────────────────────┘  │
│             │                                               │
│             │  ┌─────────────────────────────────────────┐  │
│             │  │  [Input field]              [Send]      │  │
│             │  └─────────────────────────────────────────┘  │
│             │                                               │
│             │  [Mark as Final] [Approve Room]               │
└─────────────┴───────────────────────────────────────────────┘

Legend: ✓ Approved  ● Current  ○ Pending
```

### Key Components

| Component               | Purpose                             |
| ----------------------- | ----------------------------------- |
| `DesignBriefWizard`     | Multi-step preference collection    |
| `FloorplanUploader`     | PDF/image upload with SSE progress  |
| `ManualRoomEntry`       | Fallback room entry form            |
| `ChatWrapper/ChatPanel` | AI chat interface with streaming    |
| `RoomImageViewer`       | Image gallery with object detection |
| `RoomSidebar/RoomGrid`  | Room navigation with status         |
| `ItemEditDialog`        | Object editing modal                |
| `PreferencesDialog`     | Global settings editor              |
| `ShareDialog`           | Generate and copy share link        |
| `ShoppingSummary`       | Finalize step product display       |
| `Header`                | App header with step indicators     |

---

## Environment Variables

```env
# Database
DATABASE_URL=./data/app.db

# Python LLM Service
LLM_SERVICE_URL=http://localhost:8000

# Anthropic (for chat)
ANTHROPIC_API_KEY=

# Runware (for image generation)
RUNWARE_API_KEY=

# RasterScan (for floor plan analysis - used by Python service)
RASTERSCAN_API_KEY=

# Storage
UPLOAD_DIR=./uploads
```

---

## Deployment

Deployment architecture documented separately in `DEPLOYMENT.md`.

**Key requirements:**

- Docker containers for both Next.js app and Python LLM service
- Reverse proxy (Nginx) for routing
- SSL/TLS termination
- Persistent storage for SQLite database and uploaded files

---

## Non-Functional Requirements

- **Image Resolution:** 1920x1080 (16:9 landscape) only
- **Response Time:** Image generation 10-30s with SSE progress streaming
- **Error Handling:** Graceful failures with retry options; manual fallback for analysis
- **Mobile:** Responsive design, optimized for desktop
- **Database:** SQLite with WAL mode, 5-second lock timeout

---

## Out of Scope (V1)

- Real-time collaboration
- AR/VR room preview
- Full furniture purchasing (search only)
- Cost estimation
- Version history / undo
- Mask-based image editing
- Multiple aspect ratios (16:9 only)
- User-selectable AI models
- Multiple projects per share link
- Password reset flow (users contact support)
- Email verification
- OAuth providers (Google, GitHub, etc.)
- API key authentication

---

## Authentication

### Overview

Authentication is implemented using **Better Auth** with credentials-based login (email/password). Sessions are stored in SQLite for revocability.

### Library Choice

**Better Auth** (not NextAuth) because:
- First-class SQLite support without requiring Prisma/Drizzle
- Works directly with better-sqlite3
- Simpler configuration for credentials-only auth
- Built-in password hashing (bcrypt)

### Authentication Flow

```
1. User visits protected route (/dashboard, /project/*)
        ↓
2. Middleware checks session cookie
        ↓
3. No valid session → Redirect to /login
        ↓
4. User enters email/password
        ↓
5. Better Auth validates credentials
        ↓
6. Session created in database, cookie set
        ↓
7. Redirect to original destination (or /dashboard)
```

### Database Schema

Better Auth manages these tables (replaces mock users table):

```sql
-- Users (Better Auth managed)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified INTEGER DEFAULT 0,
  name TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions (Better Auth managed)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Accounts (Better Auth managed - for credentials)
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,  -- 'credential' for email/password
  access_token TEXT,
  refresh_token TEXT,
  access_token_expires_at DATETIME,
  refresh_token_expires_at DATETIME,
  scope TEXT,
  password TEXT,  -- Hashed password for credential provider
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Verification tokens (for future email verification)
CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Password Policy

Registration requires:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

Validation implemented client-side (immediate feedback) and server-side (security).

### Route Protection

| Route Pattern | Auth Required | Behavior |
|--------------|---------------|----------|
| `/` | No | Landing page; header shows "Dashboard" link if authenticated |
| `/login` | No | Login form; redirects to `/dashboard` if already authenticated |
| `/register` | No | Registration form; redirects to `/dashboard` if already authenticated |
| `/dashboard` | Yes | Redirect to `/login` if unauthenticated |
| `/project/*` | Yes | Redirect to `/login` if unauthenticated |
| `/share/[uuid]` | No | Fully public, no auth check |
| `/api/auth/*` | No | Better Auth endpoints |
| `/api/*` (other) | Yes | Return 401 if no valid session |

### API Route Authentication

All API routes (except `/api/auth/*` and `/api/share/*`) require valid session:

```typescript
// Example API route protection
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ... handle authenticated request
}
```

### Environment Variables

```env
# Better Auth
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
BETTER_AUTH_URL=http://localhost:3000  # Base URL for auth callbacks
```

**Note:** `BETTER_AUTH_SECRET` must be set in all environments. Generate with:
```bash
openssl rand -base64 32
```

### File Structure

```
src/
├── lib/
│   └── auth.ts              # Better Auth configuration
│   └── auth-client.ts       # Client-side auth utilities
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts # Better Auth API handler
│   ├── login/
│   │   └── page.tsx         # Login page
│   ├── register/
│   │   └── page.tsx         # Registration page
│   └── (protected)/         # Route group for auth-required pages
│       ├── layout.tsx       # Auth check wrapper
│       ├── dashboard/
│       └── project/
├── components/
│   └── auth/
│       ├── login-form.tsx
│       ├── register-form.tsx
│       └── user-menu.tsx    # Header user dropdown
└── middleware.ts            # Route protection middleware
```

### UI Components

**Login Page (`/login`):**
- Minimal centered card design
- Email and password fields
- "Remember me" checkbox (extends session)
- Link to registration
- Error messages inline
- Uses Sage primary color for submit button

**Register Page (`/register`):**
- Minimal centered card design
- Name, email, password, confirm password fields
- Password strength indicator
- Terms acceptance checkbox (if needed)
- Link to login
- Uses Sage primary color for submit button

**User Menu (Header):**
- Shown when authenticated
- Displays user name/email
- Dropdown with: Dashboard, Settings (future), Logout

### Session Configuration

```typescript
// lib/auth.ts
export const auth = betterAuth({
  database: sqliteAdapter(db),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minute client cache
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // V1: no email verification
  },
});
```

### Middleware Implementation

```typescript
// middleware.ts
import { betterFetch } from "@better-fetch/fetch";
import { NextResponse, type NextRequest } from "next/server";

const protectedRoutes = ["/dashboard", "/project"];
const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if route needs protection
  const isProtected = protectedRoutes.some(route =>
    pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some(route =>
    pathname.startsWith(route)
  );

  // Get session from Better Auth
  const { data: session } = await betterFetch("/api/auth/get-session", {
    baseURL: request.nextUrl.origin,
    headers: {
      cookie: request.headers.get("cookie") || "",
    },
  });

  // Redirect unauthenticated users from protected routes
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from auth routes
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/project/:path*", "/login", "/register"],
};
```

### Migration from Mock Auth

1. Create Better Auth tables via migration
2. Remove mock auth endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/logout`)
3. Update all `user_id` references to use Better Auth session
4. Update header component to use Better Auth client
5. Add middleware for route protection
6. Test all protected routes
