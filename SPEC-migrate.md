# UI Migration Spec: Main Branch Layout Adoption

## Overview

Migrate the current feature branch to adopt **main branch's UI layout and styling** while preserving all existing **API routes, database logic, and AI integration**.

---

## Migration Summary

| Aspect | Current (feat/NEXT.js) | Target (from main) |
|--------|------------------------|-------------------|
| Layout | shadcn/ui cards, separate pages | Glass-morphism panels, 3-step wizard |
| Colors | Mixed/default | SPEC palette (Sage/Terracotta/Sand) in dark mode |
| Navigation | Dashboard → Project pages | Auth → Dashboard → 3-step wizard |
| Chat | AI-powered with tools | **Keep AI** - restyle with main's ChatPanel UI |
| Rooms | Dynamic from API/DB | **Keep dynamic** - render in main's RoomFloorplan style |
| Components | shadcn/ui throughout | Custom Tailwind classes + shadcn for dialogs only |

---

## What Stays the Same (DO NOT MODIFY)

### API Routes
All routes under `app/api/` remain unchanged:
- `/api/auth/*` - Login, logout, register
- `/api/chat` - Vercel AI SDK endpoint with tool calling
- `/api/floor-plan/*` - Upload and parsing
- `/api/images/*` - BFL Flux 2 integration (generate, edit, status polling)
- `/api/projects/*` - CRUD operations
- `/api/rooms/*` - Room management and approval
- `/api/share/*` - Shareable design links

### Database Layer
- `lib/db/*` - SQLite schema, queries, initialization
- All database tables and relationships

### AI Integration
- `lib/ai/prompts.ts` - System prompts
- `lib/ai/tools.ts` - Tool definitions (generate_room_image, edit_room_image, etc.)
- `hooks/use-chat.ts` - Vercel AI SDK hook

### External Services
- `lib/bfl/*` - BFL Flux 2 API client and polling
- `lib/storage/blob.ts` - Image/PDF storage

### Authentication Logic
- `lib/auth/mock-auth.ts` - Mock auth implementation
- `middleware.ts` - Route protection

---

## What Changes (UI/Layout Only)

### 1. Global Styles (`app/globals.css`)

Replace with main's base styles, substituting SPEC palette:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-background text-white antialiased;
}

.page-shell {
  @apply h-screen flex flex-col overflow-hidden;
}

.page-main {
  @apply flex-1 flex flex-col lg:flex-row gap-4 pt-4 pb-4 px-4 lg:px-6 w-full overflow-hidden;
}

.panel {
  @apply bg-surface/80 border border-white/10 rounded-2xl shadow-lg backdrop-blur;
}

.panel-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-white/5;
}

.panel-body {
  @apply p-4;
}

.chip {
  @apply inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-white/80 bg-white/5;
}

.chip-muted {
  @apply border-dashed border-white/10 text-white/50;
}
```

### 2. Tailwind Config (`tailwind.config.js`)

Update colors to SPEC palette in dark mode:

```js
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // SPEC palette adapted for dark mode
        background: "#1a1f1a",     // Dark Sage-tinted background
        surface: "#242924",        // Slightly lighter surface
        accent: "#627362",         // Sage primary
        "accent-warm": "#e2704d",  // Terracotta for CTAs
        sand: {
          50: "#faf9f7",
          100: "#f5f3ef",
          200: "#e6e2d8",
          800: "#3d3830",
          900: "#302a24"
        },
        sage: {
          50: "#f6f7f6",
          100: "#e8ebe8",
          500: "#627362",
          600: "#4f5d4f",
          900: "#181c18"
        },
        terracotta: {
          50: "#fdf6f3",
          500: "#e2704d",
          600: "#c85a3a",
          900: "#40180f"
        }
      }
    }
  },
  plugins: []
};
```

### 3. Root Layout (`app/layout.tsx`)

Adopt main's header navigation with auth-aware modifications:

```tsx
// Structure:
// - page-shell wrapper
// - Header with logo, step indicators, user menu
// - Conditional nav based on auth state
// - main with page-main class
```

Header shows:
- Logo: "Flux Interior Studio"
- Step indicators: 1. Questionnaire → 2. Room by room → 3. Final
- User dropdown (logout) when authenticated

### 4. Page Structure

#### Auth Pages (`/login`, `/register`)
- Apply dark glass-morphism panel styling
- Center panel on page
- Use `.panel`, `.panel-body` classes
- Keep existing form logic and API calls

#### Dashboard (`/dashboard` or `/(dashboard)/page.tsx`)
- Dark background with `.page-shell` layout
- Project cards as `.panel` elements
- "New Project" button styled with `bg-accent-warm`
- Keep existing project CRUD logic

#### Project Wizard (`/project/[id]`)

Three-step flow within the project:

**Step 1: Questionnaire (Floor Plan Upload)**
- Left panel: FloorplanUpload component (main's styling)
- Right panel: ChatPanel for describing goals
- Upload triggers `/api/floor-plan/upload` and `/api/floor-plan/parse`
- Dynamic room detection populates next step

**Step 2: Room-by-Room Design**
- Left panel: RoomFloorplan showing detected rooms (dynamic, not hardcoded)
- Room selection panel with generated image preview
- Object tags (TagPill) populated from AI vision scan
- Right panel: ChatPanel with AI tool calling
- Keep existing `/api/chat` integration

**Step 3: Final Result**
- Gallery of all approved room images
- Share button triggers `/api/share`
- Display shareable link

### 5. Component Migrations

#### FloorplanUpload
- Adopt main's visual styling (drag-drop zone, gradient icon)
- Wire to existing upload API
- Show parsing status/progress
- Display detected rooms after parse

#### ChatPanel
- Use main's bubble styling (`.bg-white/5` for assistant, `.bg-accent/80` for user)
- Wire to existing `useChat` hook
- Support inline image display from tool results
- Keep detected items list with edit buttons

#### RoomFloorplan
- Adopt main's 2x2 grid layout concept
- **Dynamically render rooms** from project's parsed data
- Selected room highlights with accent border
- Show room approval status (checkmark/pending)

#### TagPill
- Use main's `.chip` / `.chip-muted` styling
- Keep existing click-to-edit functionality for items

#### Dialogs (Preferences, Share, ItemEdit)
- **Keep shadcn/ui Dialog component**
- Style dialog content with `.panel-body` patterns
- Dark overlay backdrop

### 6. Share Page (`/share/[uuid]`)

- Apply dark glass-morphism styling
- Room images in panel cards
- Floor plan thumbnail
- Design summary
- Keep existing `/api/share/[uuid]` data fetching

---

## File Changes Summary

### Modify (Styling Only)
| File | Change |
|------|--------|
| `app/globals.css` | Replace with main's utility classes + SPEC colors |
| `tailwind.config.js` | SPEC color palette for dark mode |
| `app/layout.tsx` | Main's header/page-shell structure |
| `app/(auth)/login/page.tsx` | Dark panel styling |
| `app/(auth)/register/page.tsx` | Dark panel styling |
| `app/(dashboard)/page.tsx` | Dark panel project cards |
| `app/(dashboard)/project/[id]/page.tsx` | 3-step wizard layout |
| `app/share/[uuid]/page.tsx` | Dark panel styling |

### Adopt from Main (with modifications)
| Component | Source | Modifications |
|-----------|--------|---------------|
| `ChatPanel.tsx` | main branch | Wire to useChat hook, support images |
| `FloorplanUpload.tsx` | main branch | Wire to upload API |
| `RoomFloorplan.tsx` | main branch | Dynamic rooms from API |
| `TagPill.tsx` | main branch | Keep as-is |

### Keep from Current Branch
| File | Reason |
|------|--------|
| `components/ui/*` | shadcn Dialog, DropdownMenu for complex interactions |
| `components/chat/chat-input.tsx` | May merge into ChatPanel |
| `components/chat/chat-image.tsx` | Inline image display logic |
| `components/chat/item-edit-dialog.tsx` | Keep Dialog, restyle content |
| `components/project/preferences-dialog.tsx` | Keep Dialog, restyle content |
| `components/project/share-dialog.tsx` | Keep Dialog, restyle content |
| `components/rooms/room-image-viewer.tsx` | Gallery functionality |

### Delete (No Longer Needed)
- `components/floorplan/floorplan-uploader.tsx` (replaced by main's version)
- `components/chat/chat-interface.tsx` (replaced by ChatPanel)
- Duplicate/unused card components

---

## Implementation Order

1. **Global foundation**
   - Update `tailwind.config.js` with SPEC colors
   - Update `app/globals.css` with utility classes
   - Update `app/layout.tsx` with page-shell structure

2. **Auth pages**
   - Restyle login/register with dark panels

3. **Dashboard**
   - Restyle project list with panel cards

4. **Core components**
   - Port and adapt `ChatPanel` from main
   - Port and adapt `FloorplanUpload` from main
   - Port and adapt `RoomFloorplan` from main (make dynamic)
   - Port `TagPill` from main

5. **Project wizard**
   - Restructure `/project/[id]` as 3-step flow
   - Wire components to existing APIs

6. **Share page**
   - Apply dark styling

7. **Cleanup**
   - Remove deprecated components
   - Test all API integrations still work

---

## Visual Reference

### Color Tokens (Dark Mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#1a1f1a` | Page background |
| `surface` | `#242924` | Panel backgrounds |
| `accent` (Sage) | `#627362` | Primary actions, selected states |
| `accent-warm` (Terracotta) | `#e2704d` | CTAs, approval buttons |
| `white/80` | - | Primary text |
| `white/50` | - | Secondary text |
| `white/10` | - | Borders |

### Panel Pattern

```
┌─────────────────────────────────────┐  ← border-white/10
│  STEP 1                             │  ← panel-header
│  Upload your floor plan             │
├─────────────────────────────────────┤  ← border-b border-white/5
│                                     │
│  [Content area]                     │  ← panel-body
│                                     │
└─────────────────────────────────────┘
```

---

## Testing Checklist

After migration, verify:

- [ ] Login/register flow works
- [ ] Project creation works
- [ ] Floor plan upload and parsing works
- [ ] Room detection populates UI
- [ ] AI chat responds with tool calls
- [ ] Image generation triggers and displays
- [ ] Image editing works via item tags
- [ ] Room approval flow works
- [ ] Share link generation works
- [ ] Public share page displays correctly
- [ ] All API endpoints return expected responses
- [ ] Database operations unchanged

---

## Notes

- **No API changes** - This is purely a UI/UX migration
- **No logic changes** - All business logic preserved
- **shadcn/ui retained** - For Dialog and DropdownMenu components only
- **Dark mode only** - No light mode toggle in this migration
- **Desktop-first** - Main's layout is optimized for larger screens
