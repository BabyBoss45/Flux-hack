"""Test furniture analyzer with real product search."""

import requests
import json
from pathlib import Path

API_URL = "http://127.0.0.1:8000"
TEST_IMAGE = "d:/Flux-hack/LLM/test_llms_input/photo_2026-01-24_20-17-58.jpg"
OUTPUT_DIR = Path("d:/Flux-hack/LLM/test_output")

print("Testing Furniture Analyzer with Real Product Search...")
print(f"Image: {TEST_IMAGE}")
print()

with open(TEST_IMAGE, "rb") as f:
    response = requests.post(
        f"{API_URL}/analyze-and-shop",
        files={"image": f}
    )

print(f"Status: {response.status_code}")
result = response.json()

# Save result
with open(OUTPUT_DIR / "furniture_with_real_products.json", "w") as f:
    json.dump(result, f, indent=2)

print(f"\nOverall Style: {result.get('overall_style')}")
print(f"Objects Found: {len(result.get('objects', []))}")

print("\n" + "="*60)
print("FURNITURE WITH REAL PRODUCT LINKS")
print("="*60)

for obj in result.get("objects", []):
    print(f"\n{obj.get('name')} ({obj.get('category')})")
    print(f"  Color: {obj.get('primary_color')}")
    print(f"  Style: {', '.join(obj.get('style_tags', []))}")
    
    product = obj.get("product")
    if product:
        print(f"\n  >>> FOUND PRODUCT:")
        print(f"      Title: {product.get('title')}")
        print(f"      Price: {product.get('price', 'N/A')}")
        print(f"      Link: {product.get('link')}")
        print(f"      Source: {product.get('source', 'N/A')}")
    else:
        print(f"\n  >>> No product found")

print("\n✓ Test completed!")
