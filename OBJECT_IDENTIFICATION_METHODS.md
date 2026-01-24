# Object Identification Methods Explained

## Overview

Your system has **two identification methods** that can work together:

1. **Basic Detection** (Claude Vision) - Always used
2. **Enhanced Detection** (Python LLM Service) - Optional enhancement

Both UI display methods (overlay tags and chips) use the **same detected objects** from the database.

---

## Method 1: Basic Detection (Primary)

### What It Uses
- **LLM**: Claude Sonnet 4 Vision API
- **Model**: `claude-sonnet-4-20250514`
- **Location**: `lib/klein/object-detection.ts`

### Input
```typescript
imageUrl: string  // URL of the generated room image
```

### Process
1. Fetches image from URL
2. Converts to base64
3. Calls Claude Vision API with structured schema
4. Claude analyzes image and returns JSON

### Prompt Sent to Claude
```
Analyze the provided interior image.

Identify the main editable objects in the room.

Rules:
- Only include large, user-editable objects
- Ignore small decor and accessories
- Focus on furniture and surfaces

For each object, return:
- object_id
- object_label (e.g. sofa, coffee table, rug, wall, floor)
- object_category (furniture | surface | lighting | architectural)
- approximate bounding box as normalized coordinates [x1, y1, x2, y2]

Return JSON only.
```

### Output
```typescript
DetectedObject[] = [
  {
    id: "obj_sofa",
    label: "sofa",
    category: "furniture",
    bbox: [0.12, 0.48, 0.68, 0.82]  // [x1, y1, x2, y2] normalized 0-1
  },
  {
    id: "obj_table",
    label: "coffee table",
    category: "furniture",
    bbox: [0.42, 0.62, 0.58, 0.72]
  }
]
```

### When Used
- **Always** - This is the primary method
- Called after every image generation
- Stored in database `room_images.detected_items` column

---

## Method 2: Enhanced Detection (Optional)

### What It Uses
- **LLM**: Claude Sonnet 4 Vision API (via Python service)
- **Model**: `claude-sonnet-4-20250514`
- **Location**: `lib/klein/furniture-enhancer.ts` → Python service `LLM/src/furniture_analyzer.py`

### Input
```typescript
imageUrl: string  // Same room image URL
```

### Process
1. Fetches image from URL
2. Converts to File/Blob
3. Sends to Next.js API route `/api/llm/analyze-furniture`
4. Next.js proxies to Python service `http://localhost:8000/analyze-furniture`
5. Python service uses Claude Vision to analyze furniture
6. Returns enriched data with colors, styles, materials

### Prompt Sent to Claude (via Python)
```
Analyze this room design/interior image.

Identify ONLY the MAIN furniture pieces (max 5-6 items). Focus on:
- Large furniture: sofas, beds, tables, chairs, cabinets, desks
- Skip small items: candles, books, small plants, decorative bowls

For each main object provide:
1. name: Object name (e.g., "Sofa", "Coffee Table")
2. category: Type (bed, sofa, chair, table, desk, lamp, rug, cabinet, shelf)
3. primary_color: Main color as hex code (e.g., "#8B4513")
4. style_tags: Style descriptors (modern, vintage, minimalist, rustic, industrial)
5. material_tags: Materials (wood, metal, fabric, leather, glass)
6. description: Brief visual description for shopping search

Also provide:
- overall_style: The overall room style
- color_palette: Top 3 dominant colors
```

### Output
```typescript
FurnitureAnalysisResult = {
  status: "success",
  objects: [
    {
      name: "Three-Seat Sofa",
      category: "sofa",
      primary_color: "#A0937D",
      style_tags: ["rustic", "traditional"],
      material_tags: ["fabric"],
      description: "Beige fabric three-seat sofa with rolled arms"
    }
  ],
  overall_style: "Rustic Traditional",
  color_palette: [
    { color: "#A0937D", name: "Warm Grey" },
    { color: "#8B4513", name: "Brown" }
  ]
}
```

### Merging Process
The `mergeFurnitureAnalysis()` function:
1. Takes basic detection (Method 1) with bbox data
2. Takes furniture analysis (Method 2) with style/color data
3. Matches objects by name similarity:
   - Exact match: "sofa" === "sofa"
   - Partial match: "sofa" matches "Three-Seat Sofa"
   - Category match: "sofa" matches "couch" (synonyms)
4. Combines both into enriched objects

### Final Enriched Object
```typescript
DetectedObject = {
  // From Method 1 (Basic Detection)
  id: "obj_sofa",
  label: "sofa",
  category: "furniture",
  bbox: [0.12, 0.48, 0.68, 0.82],
  
  // From Method 2 (Enhanced Detection) - Added if match found
  primary_color: "#A0937D",
  style_tags: ["rustic", "traditional"],
  material_tags: ["fabric"],
  description: "Beige fabric three-seat sofa with rolled arms"
}
```

### When Used
- **Only if** `ENABLE_LLM_ENHANCEMENT=true` in `.env.local`
- **Only if** Python service is running on port 8000
- Falls back gracefully if service unavailable

---

## Comparison

| Feature | Method 1: Basic | Method 2: Enhanced |
|---------|-----------------|-------------------|
| **LLM** | Claude Sonnet 4 | Claude Sonnet 4 (via Python) |
| **Location** | Next.js (TypeScript) | Python service |
| **Provides** | id, label, category, bbox | name, colors, styles, materials |
| **When Used** | Always | Optional (if enabled) |
| **Speed** | Fast (direct API call) | Slower (proxy + Python) |
| **Data** | Location only | Style/color details |
| **Required** | Yes | No (optional enhancement) |

---

## How They Work Together

```
Image Generated
    ↓
Method 1: Basic Detection (Claude Vision)
    ↓
Objects with bbox: [{ id, label, category, bbox }]
    ↓
[If ENABLE_LLM_ENHANCEMENT=true]
    ↓
Method 2: Enhanced Detection (Python LLM)
    ↓
Furniture analysis: [{ name, colors, styles, materials }]
    ↓
mergeFurnitureAnalysis()
    ↓
Enriched objects: [{ id, label, category, bbox, colors, styles, materials }]
    ↓
Saved to database: room_images.detected_items
    ↓
UI displays: Overlay tags + Chips (both use same data)
```

---

## UI Display Methods (Not Identification Methods)

Both overlay tags and chips use the **same detected objects** from the database:

- **Overlay Tags**: Use `obj.bbox` to position yellow boxes on image
- **Chips**: Use `obj.label` to display button text below image

They're just different ways to **display and interact** with the same data.

