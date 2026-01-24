"""Test furniture analyzer and product search."""

import requests
import json
from pathlib import Path

API_URL = "http://127.0.0.1:8000"
OUTPUT_DIR = Path("d:/Flux-hack/LLM/test_output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Find a room design image to test with
test_images = [
    "d:/Flux-hack/LLM/test_llms_input/photo_2026-01-24_20-17-58.jpg",
    "d:/Flux-hack/LLM/test_llms_input/photo_2026-01-24_20-18-05.jpg",
    "d:/Flux-hack/LLM/test_llms_input/photo_2026-01-24_20-18-08.jpg",
]

test_image = None
for img in test_images:
    if Path(img).exists():
        test_image = img
        break

if not test_image:
    print("No test image found!")
    exit(1)

print(f"Testing furniture analyzer...")
print(f"Image: {test_image}")
print()

# Test /analyze-furniture endpoint
print("=" * 50)
print("Testing /analyze-furniture endpoint")
print("=" * 50)

with open(test_image, "rb") as f:
    response = requests.post(
        f"{API_URL}/analyze-furniture",
        files={"image": f}
    )

print(f"Status: {response.status_code}")

if response.status_code == 200:
    result = response.json()
    
    # Save result
    with open(OUTPUT_DIR / "furniture_analysis.json", "w") as f:
        json.dump(result, f, indent=2)
    print(f"Saved to: {OUTPUT_DIR / 'furniture_analysis.json'}")
    
    print(f"\nOverall Style: {result.get('overall_style')}")
    print(f"Objects Found: {len(result.get('objects', []))}")
    
    print("\n--- OBJECTS ---")
    for obj in result.get("objects", []):
        print(f"\n{obj.get('name')}:")
        print(f"  Category: {obj.get('category')}")
        print(f"  Primary Color: {obj.get('primary_color')}")
        print(f"  Style: {', '.join(obj.get('style_tags', []))}")
        print(f"  Materials: {', '.join(obj.get('material_tags', []))}")
    
    print("\n--- COLOR PALETTE ---")
    for color in result.get("color_palette", []):
        print(f"  {color.get('name')}: {color.get('color')}")
    
    # Test /analyze-and-shop with the same image
    print("\n" + "=" * 50)
    print("Testing /analyze-and-shop endpoint")
    print("=" * 50)
    
    with open(test_image, "rb") as f:
        response2 = requests.post(
            f"{API_URL}/analyze-and-shop",
            files={"image": f}
        )
    
    print(f"Status: {response2.status_code}")
    
    if response2.status_code == 200:
        shop_result = response2.json()
        
        # Save result
        with open(OUTPUT_DIR / "furniture_with_shopping.json", "w") as f:
            json.dump(shop_result, f, indent=2)
        print(f"Saved to: {OUTPUT_DIR / 'furniture_with_shopping.json'}")
        
        print("\n--- SHOPPING LINKS ---")
        for obj in shop_result.get("objects", []):
            print(f"\n{obj.get('name')}:")
            shopping = obj.get("shopping", {})
            recs = shopping.get("recommendations", [])
            for rec in recs:
                print(f"  [{rec.get('store')}] {rec.get('search_query')}")
                print(f"    Price: {rec.get('price_range')}")
                print(f"    Link: {rec.get('url')}")
    else:
        print(f"Error: {response2.text}")

else:
    print(f"Error: {response.text}")

print("\n✓ Test completed!")
