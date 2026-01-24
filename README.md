# Flux Interior Design

AI-powered interior design application built with Next.js, SQLite, and the BFL (Black Forest Labs) image generation API.

## Getting Started

### Quick Start (Next.js Only)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

### Full Development Setup (with LLM Floor Plan Analysis)

The application includes an AI-powered floor plan analyzer that requires a separate Python service. To use this feature, you need to run both services:

**Terminal 1 - Start LLM Service:**
```bash
cd LLM
uv pip install -r requirements.txt
uv run uvicorn src.api:app --host 0.0.0.0 --port 8000
```

**Terminal 2 - Start Next.js:**
```bash
npm install
npm run dev
```

**Access the application:**
- Next.js: http://localhost:3000
- LLM API documentation: http://localhost:8000/docs

**Test the integration:**
```bash
npx tsx scripts/test-llm-integration.ts
```

> **Note:** The LLM service requires valid API keys for Anthropic Claude and RasterScan. Configure these in `LLM/.env` (see Environment Variables section).

## Environment Variables

### Root `.env` (Next.js)

```env
# Database
DATABASE_URL=sqlite.db

# BFL Flux 2 API
BFL_API_KEY=your_bfl_api_key

# Anthropic Claude API
ANTHROPIC_API_KEY=your_anthropic_api_key
RASTERSCAN_API_KEY=your_rasterscan_api_key
RASTERSCAN_URL=https://backend.rasterscan.com/raster-to-vector-base64

# LLM Service
LLM_SERVICE_URL=http://localhost:8000

# Application URL
NEXT_PUBLIC_URL=http://localhost:3000
```

### `LLM/.env` (Python LLM Service)

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
RASTERSCAN_API_KEY=your_rasterscan_api_key
RASTERSCAN_URL=https://backend.rasterscan.com/raster-to-vector-base64
```

---

## API Reference

All endpoints require authentication via session cookie unless otherwise noted.

### Authentication

#### POST `/api/auth/register`

Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### POST `/api/auth/login`

Login with email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

#### POST `/api/auth/logout`

Logout current user.

**Request:** None

**Response:**
```json
{
  "success": true
}
```

---

### Projects

#### GET `/api/projects`

Get all projects for the authenticated user.

**Response:**
```json
{
  "projects": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Modern Home Redesign",
      "floor_plan_url": "/uploads/floor-plans/plan.pdf",
      "global_preferences": "{\"style\":\"modern\",\"colors\":[\"white\",\"gray\"]}",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/projects`

Create a new project.

**Request:**
```json
{
  "name": "Beach House Renovation"
}
```

**Response:**
```json
{
  "project": {
    "id": 2,
    "user_id": 1,
    "name": "Beach House Renovation",
    "floor_plan_url": null,
    "global_preferences": "{}",
    "created_at": "2024-01-15T14:00:00.000Z",
    "updated_at": "2024-01-15T14:00:00.000Z"
  }
}
```

---

#### GET `/api/projects/:id`

Get a project with its rooms.

**Response:**
```json
{
  "project": {
    "id": 1,
    "user_id": 1,
    "name": "Modern Home Redesign",
    "floor_plan_url": "/uploads/floor-plans/plan.pdf",
    "global_preferences": "{\"style\":\"modern\"}",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T12:00:00.000Z"
  },
  "rooms": [
    {
      "id": 1,
      "project_id": 1,
      "name": "Living Room",
      "type": "Living Room",
      "geometry": "{\"width\":20,\"height\":15}",
      "doors": "[\"Entry\",\"To Kitchen\"]",
      "windows": "[\"South Window\"]",
      "fixtures": "[]",
      "adjacent_rooms": "[\"Kitchen\"]",
      "approved": 0,
      "created_at": "2024-01-15T10:35:00.000Z",
      "updated_at": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

---

#### PATCH `/api/projects/:id`

Update a project.

**Request:**
```json
{
  "name": "Updated Project Name",
  "global_preferences": "{\"style\":\"minimalist\"}"
}
```

**Response:**
```json
{
  "project": {
    "id": 1,
    "name": "Updated Project Name",
    "global_preferences": "{\"style\":\"minimalist\"}",
    "updated_at": "2024-01-15T15:00:00.000Z"
  }
}
```

---

#### DELETE `/api/projects/:id`

Delete a project.

**Response:**
```json
{
  "success": true
}
```

---

### Rooms

#### GET `/api/projects/:id/rooms`

Get all rooms for a project.

**Response:**
```json
{
  "rooms": [
    {
      "id": 1,
      "project_id": 1,
      "name": "Living Room",
      "type": "Living Room",
      "geometry": "{\"width\":20,\"height\":15}",
      "doors": "[\"Entry\"]",
      "windows": "[\"South Window\"]",
      "fixtures": "[]",
      "adjacent_rooms": "[\"Kitchen\"]",
      "approved": 0,
      "created_at": "2024-01-15T10:35:00.000Z",
      "updated_at": "2024-01-15T10:35:00.000Z"
    }
  ]
}
```

---

#### POST `/api/projects/:id/rooms`

Create a new room.

**Request:**
```json
{
  "name": "Master Bedroom",
  "type": "Bedroom"
}
```

**Response:**
```json
{
  "room": {
    "id": 2,
    "project_id": 1,
    "name": "Master Bedroom",
    "type": "Bedroom",
    "geometry": "{}",
    "doors": "[]",
    "windows": "[]",
    "fixtures": "[]",
    "adjacent_rooms": "[]",
    "approved": 0,
    "created_at": "2024-01-15T11:00:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

---

#### GET `/api/rooms/:id`

Get a single room.

**Response:**
```json
{
  "room": {
    "id": 1,
    "project_id": 1,
    "name": "Living Room",
    "type": "Living Room",
    "geometry": "{\"width\":20,\"height\":15}",
    "doors": "[\"Entry\"]",
    "windows": "[\"South Window\"]",
    "fixtures": "[]",
    "adjacent_rooms": "[\"Kitchen\"]",
    "approved": 0,
    "created_at": "2024-01-15T10:35:00.000Z",
    "updated_at": "2024-01-15T10:35:00.000Z"
  }
}
```

---

#### PATCH `/api/rooms/:id`

Update a room.

**Request:**
```json
{
  "name": "Family Room",
  "geometry": "{\"width\":25,\"height\":18}",
  "fixtures": "[\"Fireplace\",\"Built-in Shelves\"]"
}
```

**Response:**
```json
{
  "room": {
    "id": 1,
    "name": "Family Room",
    "geometry": "{\"width\":25,\"height\":18}",
    "fixtures": "[\"Fireplace\",\"Built-in Shelves\"]",
    "updated_at": "2024-01-15T16:00:00.000Z"
  }
}
```

---

#### DELETE `/api/rooms/:id`

Delete a room.

**Response:**
```json
{
  "success": true
}
```

---

#### POST `/api/rooms/:id/approve`

Approve a room design (requires at least one image).

**Response:**
```json
{
  "room": {
    "id": 1,
    "approved": 1,
    "updated_at": "2024-01-15T17:00:00.000Z"
  },
  "message": "Room approved successfully"
}
```

**Error (no images):**
```json
{
  "error": "Room must have at least one design image before approval"
}
```

---

### Room Images

#### GET `/api/rooms/:id/images`

Get all images for a room.

**Response:**
```json
{
  "images": [
    {
      "id": 1,
      "room_id": 1,
      "url": "https://storage.example.com/images/design-1.png",
      "prompt": "Modern minimalist living room with large windows",
      "view_type": "perspective",
      "detected_items": "[\"sofa\",\"coffee table\",\"floor lamp\"]",
      "created_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

---

#### POST `/api/rooms/:id/images`

Save a generated image to a room.

**Request:**
```json
{
  "url": "https://storage.example.com/images/design-2.png",
  "prompt": "Scandinavian style living room with wooden furniture",
  "viewType": "perspective",
  "detectedItems": "[\"sofa\",\"bookshelf\",\"rug\"]"
}
```

**Response:**
```json
{
  "image": {
    "id": 2,
    "room_id": 1,
    "url": "https://storage.example.com/images/design-2.png",
    "prompt": "Scandinavian style living room with wooden furniture",
    "view_type": "perspective",
    "detected_items": "[\"sofa\",\"bookshelf\",\"rug\"]",
    "created_at": "2024-01-15T13:00:00.000Z"
  }
}
```

---

### Image Generation

#### POST `/api/images/generate`

Generate a new interior design image.

**Request:**
```json
{
  "prompt": "Modern minimalist kitchen with white cabinets and marble countertops",
  "width": 1024,
  "height": 768,
  "async": false
}
```

**Response (sync mode):**
```json
{
  "imageUrl": "https://bfl-cdn.example.com/generated/abc123.png"
}
```

**Response (async mode):**
```json
{
  "jobId": "job_abc123xyz",
  "status": "pending"
}
```

---

#### POST `/api/images/edit`

Edit an existing image with a prompt.

**Request:**
```json
{
  "image": "https://example.com/original-image.png",
  "prompt": "Replace the blue sofa with a tan leather sectional",
  "mask": "base64_encoded_mask_image",
  "strength": 0.8,
  "async": false
}
```

**Response (sync mode):**
```json
{
  "imageUrl": "https://bfl-cdn.example.com/edited/def456.png"
}
```

**Response (async mode):**
```json
{
  "jobId": "job_def456abc",
  "status": "pending"
}
```

---

#### GET `/api/images/status/:jobId`

Check the status of an async image generation job.

**Response (pending):**
```json
{
  "status": "pending"
}
```

**Response (completed):**
```json
{
  "status": "completed",
  "imageUrl": "https://bfl-cdn.example.com/generated/abc123.png"
}
```

**Response (error):**
```json
{
  "status": "error",
  "error": "Content was moderated by safety filters"
}
```

---

### Floor Plan

#### POST `/api/floor-plan/upload`

Upload and analyze a floor plan with AI. This endpoint uses Server-Sent Events (SSE) to stream progress updates.

**Request:** `multipart/form-data`
- `file`: PDF, PNG, or JPEG file (max 20MB)
- `projectId`: Project ID (integer)

**Response:** Server-Sent Events (SSE) stream

**Progress Event:**
```
event: progress
data: {"status":"analyzing","message":"Analyzing floor plan with AI..."}
```

**Complete Event:**
```
event: complete
data: {
  "floor_plan_url": "/uploads/floor-plans/uuid.png",
  "annotated_floor_plan_url": "/uploads/floor-plans/uuid-annotated.png",
  "rooms": [
    {
      "id": 1,
      "project_id": 1,
      "name": "Living Room",
      "type": "Living Room",
      "geometry": "{\"length_ft\":20,\"width_ft\":15,\"area_sqft\":300}",
      "doors": "[{\"location\":\"north\",\"type\":\"standard\",\"width_ft\":3}]",
      "windows": "[{\"location\":\"south\",\"width_ft\":4,\"height_ft\":5}]",
      "fixtures": "[]",
      "adjacent_rooms": "[\"Kitchen\"]"
    }
  ],
  "room_count": 1,
  "total_area_sqft": 300
}
```

**Error Event:**
```
event: error
data: {"error":"LLM service unavailable"}
```

---

#### GET `/api/floor-plan/health`

Check LLM service health status.

**Response:**
```json
{
  "status": "healthy",
  "llm_service": {
    "reachable": true
  }
}
```

---

#### POST `/api/floor-plan/parse`

**⚠️ DEPRECATED:** This endpoint is deprecated. Use `POST /api/floor-plan/upload` instead.

**Response:**
```json
{
  "error": "ENDPOINT_DEPRECATED",
  "message": "This endpoint is deprecated. Please use POST /api/floor-plan/upload instead."
}
```

---

### Sharing

#### POST `/api/share`

Create a shareable link for a project (all rooms must be approved).

**Request:**
```json
{
  "projectId": 1
}
```

**Response:**
```json
{
  "url": "http://localhost:3000/share/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Error (rooms not approved):**
```json
{
  "error": "All rooms must be approved before sharing"
}
```

---

#### GET `/api/share/:uuid`

Get shared project data (public, no authentication required).

**Response:**
```json
{
  "project": {
    "name": "Modern Home Redesign",
    "preferences": {
      "style": "modern",
      "colors": ["white", "gray"]
    }
  },
  "rooms": [
    {
      "id": 1,
      "name": "Living Room",
      "type": "Living Room",
      "images": [
        {
          "id": 1,
          "url": "https://storage.example.com/images/design-1.png",
          "prompt": "Modern minimalist living room",
          "view_type": "perspective",
          "detected_items": ["sofa", "coffee table"]
        }
      ]
    }
  ]
}
```

---

### Chat (AI Assistant)

#### POST `/api/chat`

Send a message to the AI design assistant.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I want a modern Bauhaus style for my living room"
    }
  ],
  "projectId": 1,
  "roomId": 1
}
```

**Response:** Server-Sent Events (SSE) text stream

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (accessing another user's resources)
- `404` - Not Found
- `500` - Internal Server Error

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: SQLite (better-sqlite3)
- **AI**: Claude (Anthropic) for chat, BFL for image generation
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
