# LLM Service Integration with Next.js

This document explains how the Python LLM furniture analyzer service integrates with the Next.js object identification system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                         │
│  (Room Image Viewer with Object Tags)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Next.js API Routes                             │
│  /api/chat → detectObjects() → /api/llm/analyze-furniture  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Python LLM Service (FastAPI)                       │
│  http://localhost:8000                                      │
│  - /analyze-furniture: Identify furniture + colors/styles │
│  - /search-products: Find similar products online          │
└─────────────────────────────────────────────────────────────┘
```

## Two-Stage Object Detection

### Stage 1: Bbox Detection (Claude Vision)
- **Location**: `lib/klein/object-detection.ts`
- **Purpose**: Identifies objects and their bounding boxes
- **Output**: `{ id, label, category, bbox }`

### Stage 2: Furniture Analysis (Python LLM)
- **Location**: `lib/klein/furniture-enhancer.ts`
- **Purpose**: Enriches objects with colors, styles, materials
- **Output**: `{ primary_color, style_tags, material_tags, description }`

### Merging
The `mergeFurnitureAnalysis()` function matches objects by name and combines:
- Bbox data (from Stage 1)
- Furniture details (from Stage 2)

## Setup

### 1. Start Python LLM Service

```bash
cd LLM
pip install -r requirements.txt

# Create .env file
echo "ANTHROPIC_API_KEY=your_key_here" > .env
echo "THORDATA_API_KEY=your_key_here" >> .env

# Start server
python3 -m uvicorn src.api:app --reload --port 8000
```

### 2. Configure Next.js

Add to your `.env.local`:

```bash
# Python LLM service URL
LLM_SERVICE_URL=http://localhost:8000

# Enable LLM enhancement (optional, defaults to false)
ENABLE_LLM_ENHANCEMENT=true
```

### 3. Usage

The integration is **automatic** when `ENABLE_LLM_ENHANCEMENT=true`:

```typescript
// In app/api/chat/route.ts
detectedObjects = await detectObjects(finalImageUrl, {
  enhanceWithLLM: process.env.ENABLE_LLM_ENHANCEMENT === 'true',
});
```

## API Endpoints

### POST `/api/llm/analyze-furniture`

Proxies to Python service `/analyze-furniture`.

**Request:**
```typescript
const formData = new FormData();
formData.append('image', imageFile);

const response = await fetch('/api/llm/analyze-furniture', {
  method: 'POST',
  body: formData,
});
```

**Response:**
```json
{
  "status": "success",
  "objects": [
    {
      "name": "Three-Seat Sofa",
      "category": "sofa",
      "primary_color": "#A0937D",
      "style_tags": ["rustic", "traditional"],
      "material_tags": ["fabric"],
      "description": "Beige fabric three-seat sofa with rolled arms"
    }
  ],
  "overall_style": "Rustic Traditional",
  "color_palette": [...]
}
```

### POST `/api/llm/search-products`

Proxies to Python service `/search-products`.

**Request:**
```typescript
const response = await fetch('/api/llm/search-products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    furniture: {
      name: "Sofa",
      category: "sofa",
      primary_color: "#A0937D",
      style_tags: ["rustic"],
      material_tags: ["fabric"]
    }
  }),
});
```

**Response:**
```json
{
  "status": "success",
  "recommendations": [
    {
      "search_query": "gray fabric sofa",
      "store": "Wayfair",
      "price_range": "$500-$900",
      "url": "https://www.wayfair.com/..."
    }
  ]
}
```

## Enhanced Object Data

After integration, `DetectedObject` includes:

```typescript
type DetectedObject = {
  // Basic (from bbox detection)
  id: string;
  label: string;
  category: 'furniture' | 'surface' | 'lighting' | 'architectural';
  bbox: [number, number, number, number];
  
  // Enhanced (from LLM analysis)
  primary_color?: string;        // "#8B4513"
  style_tags?: string[];         // ["modern", "minimalist"]
  material_tags?: string[];       // ["wood", "fabric"]
  description?: string;           // "Beige fabric sofa..."
  product_recommendations?: [...]; // Shopping links
};
```

## Matching Logic

The `mergeFurnitureAnalysis()` function uses three matching strategies:

1. **Exact match**: "sofa" === "sofa"
2. **Partial match**: "sofa" matches "Three-Seat Sofa"
3. **Category match**: "sofa" matches "couch" (synonyms)

## Error Handling

- If Python service is unavailable, falls back to basic detection
- If matching fails, returns original object without enhancement
- All errors are logged but don't break the flow

## Future Enhancements

- [ ] Product search UI component
- [ ] Visual product recommendations in object tags
- [ ] Price comparison display
- [ ] Shopping cart integration

