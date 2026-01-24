"""Test floor plan analyzer with button positioning."""

import requests
import json
from pathlib import Path

API_URL = "http://127.0.0.1:8000"
OUTPUT_DIR = Path("d:/Flux-hack/LLM/test_output")

# Use the blueprint image
TEST_IMAGE = "d:/Flux-hack/LLM/test_llms_input/outputBrint.png"

print("Testing Floor Plan Analyzer with Button Positioning...")
print(f"Image: {TEST_IMAGE}")
print()

# Test the /analyze endpoint
with open(TEST_IMAGE, "rb") as f:
    response = requests.post(
        f"{API_URL}/analyze",
        files={"image": f}
    )

print(f"Status: {response.status_code}")
result = response.json()

# Save result
with open(OUTPUT_DIR / "floor_plan_with_buttons.json", "w") as f:
    json.dump(result, f, indent=2)

if result.get("status") == "success":
    print(f"\n✓ Analysis successful!")
    print(f"  Rooms found: {result.get('room_count')}")
    print(f"  Total area: {result.get('total_area_sqft')} sq ft")
    print(f"  Image dimensions: {result.get('image_dimensions')}")
    
    print("\n" + "="*60)
    print("ROOM BUTTONS FOR FRONTEND")
    print("="*60)
    
    room_buttons = result.get("room_buttons", [])
    for btn in room_buttons:
        room_data = btn.get("room_data", {})
        print(f"\n📍 Button: {room_data.get('name', 'Unknown')}")
        print(f"   Position: ({btn.get('x_percent')}%, {btn.get('y_percent')}%)")
        print(f"   Type: {room_data.get('type')}")
        print(f"   Area: {room_data.get('area_sqft')} sq ft")
    
    print("\n" + "="*60)
    print("ROOMS DATA")
    print("="*60)
    
    for room in result.get("rooms", []):
        print(f"\n🏠 {room.get('name')} ({room.get('type')})")
        print(f"   Area: {room.get('area_sqft')} sq ft")
        dims = room.get('dimensions', {})
        print(f"   Dimensions: {dims.get('length')} x {dims.get('width')}")
        print(f"   Fixtures: {', '.join(room.get('fixtures', []))}")
    
    # Check if annotated image was saved
    if result.get("annotated_image_base64"):
        import base64
        img_data = base64.b64decode(result["annotated_image_base64"])
        with open(OUTPUT_DIR / "floor_plan_annotated.png", "wb") as f:
            f.write(img_data)
        print(f"\n✓ Annotated image saved to: {OUTPUT_DIR / 'floor_plan_annotated.png'}")
else:
    print(f"\n✗ Analysis failed: {result.get('error')}")

print("\n✓ Test completed!")
