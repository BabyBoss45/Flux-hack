# Floor Plan Analyzer

Automatically analyzes floor plan images and extracts room information using AI.

## What It Does

**Input:** Upload a floor plan image (PNG, JPEG, etc.)

**Output:** 
- **Annotated Image:** Floor plan with colored room overlays
- **JSON Data:** Detailed information about each room (name, type, area, dimensions, fixtures)

## Quick Start (3 Steps)

### Step 1: Install Dependencies

```bash
cd LLM
pip install -r requirements.txt
```

### Step 2: Add Your API Keys

Create a `.env` file in the `LLM` folder:
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
RASTERSCAN_API_KEY=your_rasterscan_api_key_here
```

**Where to get API keys:**
- Anthropic (Claude): https://console.anthropic.com/
- RasterScan: Contact RasterScan for API access

### Step 3: Start the Server

```bash
python3 -m uvicorn src.api:app --reload --port 8000
```

Server will start at: **http://localhost:8000**

View API docs at: **http://localhost:8000/docs**

## API Endpoints

### POST /analyze

Analyze floor plan and get JSON response with rooms data and base64 image.

```bash
curl -X POST http://localhost:8000/analyze \
  -F "image=@floor_plan.png" \
  -F "context=residential apartment"
```

**Response:**
```json
{
  "status": "success",
  "rooms": [
    {
      "name": "Living Room",
      "type": "living_room",
      "area_sqft": 208,
      "area_sqm": 19.3,
      "dimensions": {
        "length": "15'4\"",
        "width": "13'6\"",
        "length_m": 4.7,
        "width_m": 4.1
      },
      "fixtures": ["window", "door"],
      "doors": [{"position": "south", "type": "standard", "connects_to": "entrance"}],
      "windows": [{"position": "north", "count": 2}],
      "adjacent_rooms": ["kitchen", "entrance"]
    }
  ],
  "annotated_image_base64": "iVBORw0KGgo...",
  "total_area_sqft": 495,
  "room_count": 5
}
```

### POST /analyze/image

Returns annotated PNG image directly (not JSON).

```bash
curl -X POST http://localhost:8000/analyze/image \
  -F "image=@floor_plan.png" \
  -o output.png
```

### GET /health

Health check endpoint.

## Using in Your Code

### Option 1: Call the API (Recommended)

```python
import requests
import base64

# Send floor plan to API
with open("floor_plan.png", "rb") as f:
    response = requests.post(
        "http://localhost:8000/analyze",
        files={"image": f},
        data={"context": "residential apartment"}
    )

result = response.json()

# Get results
rooms = result["rooms"]  # List of room data
image_base64 = result["annotated_image_base64"]  # Annotated image

# Save annotated image
with open("output.png", "wb") as f:
    f.write(base64.b64decode(image_base64))

# Print room info
for room in rooms:
    print(f"{room['name']}: {room['area_sqft']} sq ft")
```

### Option 2: Import Directly

```python
from src.floor_plan_analyzer import FloorPlanAnalyzer

analyzer = FloorPlanAnalyzer()

with open("floor_plan.png", "rb") as f:
    image_bytes = f.read()

result = await analyzer.analyze(image_bytes, context="residential")

# Access results
rooms = result["rooms"]
image_b64 = result["annotated_image_base64"]
```

## Room Data Structure

Each room in the `rooms` array contains:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Room name (e.g., "Living Room") |
| `type` | string | Room type (bedroom, bathroom, kitchen, etc.) |
| `area_sqft` | number | Area in square feet |
| `area_sqm` | number | Area in square meters |
| `dimensions` | object | Length/width in imperial and metric |
| `fixtures` | array | List of fixtures (sink, toilet, stove, etc.) |
| `doors` | array | Doors with position and connection |
| `windows` | array | Windows with position and count |
| `adjacent_rooms` | array | Connected room names |

## Room Types

- bedroom, bathroom, kitchen, living_room, dining_room
- office, entrance, hallway, closet, storage
- utility, garage, balcony, other

## File Structure

```
LLM/
├── src/
│   ├── __init__.py
│   ├── api.py                  # FastAPI server
│   └── floor_plan_analyzer.py  # Core analyzer service
├── .env                        # API keys (create this)
├── .env.example                # Template
├── requirements.txt            # Dependencies
└── README.md
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `RASTERSCAN_API_KEY` | Yes | RasterScan API key |

## Supported Image Formats

PNG, JPEG, GIF, WebP (max 20MB)

## Example Output

**Input:** Floor plan image

**Output JSON:**
```json
{
  "status": "success",
  "room_count": 5,
  "total_area_sqft": 495,
  "rooms": [
    {
      "name": "Living Room",
      "type": "living_room",
      "area_sqft": 208,
      "area_sqm": 19.3,
      "dimensions": {
        "length": "15'4\"",
        "width": "13'11\""
      },
      "fixtures": ["window"],
      "doors": [...],
      "windows": [...]
    }
  ],
  "annotated_image_base64": "iVBORw0KGgo..."
}
```

**Output Image:** Floor plan with colored room overlays (see `test_output/annotated_floor_plan.png` for example)

## Troubleshooting

**Server won't start:**
- Make sure port 8000 is not in use
- Check that all dependencies are installed: `pip install -r requirements.txt`

**API returns errors:**
- Verify API keys are set correctly in `.env` file
- Check that both ANTHROPIC_API_KEY and RASTERSCAN_API_KEY are valid

**No colored overlays on output image:**
- RasterScan API may be down or key is invalid
- Check server logs for "RasterScan overlay: received" message

## Need Help?

- View interactive API docs: http://localhost:8000/docs
- Check server logs for detailed error messages
- Verify `.env` file exists and has correct API keys
