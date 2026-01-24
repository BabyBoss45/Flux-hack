"""
Floor Plan Analyzer Service

Analyzes floor plan images using RasterScan for room segmentation 
and Claude Vision API for semantic understanding.

Input: Floor plan image (PNG, JPEG, etc.)
Output: 
  - Annotated image with colored room overlays
  - JSON with detailed room parameters
"""

import base64
import io
import json
import re
import os
from typing import Dict, List, Optional, Tuple
from PIL import Image
import httpx
import anthropic
from dotenv import load_dotenv

load_dotenv()


class FloorPlanAnalyzer:
    """
    Main service for analyzing floor plans.
    
    Usage:
        analyzer = FloorPlanAnalyzer()
        result = await analyzer.analyze(image_bytes)
        
        # result contains:
        # - "rooms": list of room data with parameters
        # - "annotated_image_base64": base64 encoded PNG with overlays
        # - "total_area_sqft": total floor area
        # - "room_count": number of rooms detected
    """
    
    def __init__(
        self,
        rasterscan_api_key: Optional[str] = None,
        claude_api_key: Optional[str] = None,
        overlay_alpha: int = 140
    ):
        self.rasterscan_url = "https://backend.rasterscan.com/raster-to-vector-base64"
        self.rasterscan_api_key = rasterscan_api_key or os.getenv("RASTERSCAN_API_KEY")
        self.claude_api_key = claude_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.overlay_alpha = overlay_alpha
        self.model = "claude-sonnet-4-20250514"
        
        if self.claude_api_key:
            self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        else:
            self.claude_client = None
    
    async def analyze(
        self, 
        image_bytes: bytes, 
        context: Optional[str] = None
    ) -> Dict:
        """
        Analyze a floor plan image.
        
        Args:
            image_bytes: Raw image bytes (PNG, JPEG, etc.)
            context: Optional context hint (e.g., "residential apartment", "office")
        
        Returns:
            Dict with:
                - status: "success" or "error"
                - rooms: List of room dictionaries with parameters
                - annotated_image_base64: Base64 encoded PNG with room overlays
                - total_area_sqft: Total floor area in square feet
                - room_count: Number of rooms detected
        """
        try:
            original_image = Image.open(io.BytesIO(image_bytes))
            if original_image.mode != 'RGBA':
                original_image = original_image.convert('RGBA')
            
            width, height = original_image.size
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            # Get RasterScan overlay
            print(f"Requesting RasterScan overlay for {width}x{height} image...")
            rasterscan_image = await self._get_rasterscan_overlay(
                image_base64, 
                original_image.size
            )
            print(f"RasterScan overlay: {'received' if rasterscan_image else 'failed/none'}")
            
            # Get room data from Claude
            rooms_data = self._analyze_with_claude(image_base64, width, height, context)
            
            # Create annotated image
            annotated_image = self._create_annotated_image(
                original_image, 
                rasterscan_image
            )
            
            # Encode output image
            output_buffer = io.BytesIO()
            annotated_image.save(output_buffer, format='PNG')
            annotated_base64 = base64.b64encode(output_buffer.getvalue()).decode('utf-8')
            
            # Calculate total area
            total_area = sum(r.get('area_sqft', 0) for r in rooms_data)
            
            return {
                "status": "success",
                "rooms": rooms_data,
                "annotated_image_base64": annotated_base64,
                "total_area_sqft": total_area,
                "room_count": len(rooms_data)
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "rooms": [],
                "annotated_image_base64": None,
                "total_area_sqft": 0,
                "room_count": 0
            }
    
    async def _get_rasterscan_overlay(
        self, 
        image_base64: str, 
        target_size: Tuple[int, int]
    ) -> Optional[Image.Image]:
        """Get room segmentation overlay from RasterScan API."""
        if not self.rasterscan_api_key:
            return None
        
        try:
            print(f"Calling RasterScan API: {self.rasterscan_url}")
            print(f"API key present: {bool(self.rasterscan_api_key)}")
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.rasterscan_url,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self.rasterscan_api_key
                    },
                    json={"image": image_base64}
                )
                
                print(f"RasterScan response status: {response.status_code}")
                if response.status_code != 200:
                    print(f"RasterScan API error: {response.text[:500]}")
                    return None
                
                result = response.json()
                print(f"RasterScan response keys: {list(result.keys())}")
                
                # RasterScan returns: {"message": "...", "data": {"image": "base64...", ...}}
                data = result.get("data", {})
                highlighted_b64 = data.get("image")
                
                if not highlighted_b64:
                    print(f"No 'image' in data. Available keys: {list(data.keys())}")
                    return None
                
                print(f"RasterScan overlay image received, size: {len(highlighted_b64)} chars")
                
                # RasterScan returns data URI format: "data:image/jpg;base64,<base64_data>"
                if highlighted_b64.startswith('data:'):
                    # Extract base64 data after the comma
                    highlighted_b64 = highlighted_b64.split(',', 1)[1]
                
                # Fix base64 padding if needed
                missing_padding = len(highlighted_b64) % 4
                if missing_padding:
                    highlighted_b64 += '=' * (4 - missing_padding)
                
                rs_bytes = base64.b64decode(highlighted_b64)
                rs_image = Image.open(io.BytesIO(rs_bytes)).convert('RGBA')
                
                if rs_image.size != target_size:
                    rs_image = rs_image.resize(target_size, Image.Resampling.LANCZOS)
                
                # Apply transparency
                pixels = rs_image.load()
                for y in range(rs_image.height):
                    for x in range(rs_image.width):
                        r, g, b, a = pixels[x, y]
                        if r > 240 and g > 240 and b > 240:
                            pixels[x, y] = (r, g, b, 0)
                        elif r < 50 and g < 50 and b < 50:
                            pixels[x, y] = (r, g, b, 0)
                        else:
                            pixels[x, y] = (r, g, b, self.overlay_alpha)
                
                return rs_image
                
        except Exception as e:
            print(f"RasterScan error: {e}")
            return None
    
    def _analyze_with_claude(
        self, 
        image_base64: str, 
        width: int, 
        height: int,
        context: Optional[str] = None
    ) -> List[Dict]:
        """Extract room information using Claude Vision API."""
        if not self.claude_client:
            return []
        
        context_hint = f"\nContext: This is a {context}." if context else ""
        
        prompt = f"""Analyze this floor plan image ({width}x{height} pixels).{context_hint}

Extract information about EVERY room/space in the floor plan.

For each room provide:
1. name: Room name (read from labels or infer from fixtures)
2. type: Category (bedroom, bathroom, kitchen, living_room, dining_room, office, entrance, hallway, closet, storage, utility, garage, balcony, other)
3. area_sqft: Area in square feet (read or estimate)
4. area_sqm: Area in square meters
5. dimensions: Object with length, width (imperial and metric)
6. fixtures: List of fixtures/furniture visible
7. doors: List of doors with position and connection
8. windows: List of windows with position and count
9. adjacent_rooms: List of connected room names

Return ONLY valid JSON (no markdown, no explanation):

{{"rooms": [
  {{
    "name": "Living Room",
    "type": "living_room",
    "area_sqft": 208,
    "area_sqm": 19.3,
    "dimensions": {{
      "length": "15'4\\"",
      "width": "13'6\\"",
      "length_m": 4.7,
      "width_m": 4.1
    }},
    "fixtures": ["window", "door"],
    "doors": [{{"position": "south", "type": "standard", "connects_to": "entrance"}}],
    "windows": [{{"position": "north", "count": 2, "type": "standard"}}],
    "adjacent_rooms": ["kitchen", "entrance"]
  }}
]}}

Include ALL rooms. Be precise with dimensions shown in the plan."""

        try:
            response = self.claude_client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_base64
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }]
            )
            
            response_text = response.content[0].text.strip()
            
            # Clean markdown if present
            if response_text.startswith("```"):
                response_text = re.sub(r'^```\w*\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            data = json.loads(response_text)
            return data.get("rooms", [])
            
        except Exception as e:
            print(f"Claude error: {e}")
            return []
    
    def _create_annotated_image(
        self, 
        original: Image.Image, 
        rasterscan_overlay: Optional[Image.Image]
    ) -> Image.Image:
        """Create final image with RasterScan overlay."""
        if rasterscan_overlay:
            result = Image.alpha_composite(original, rasterscan_overlay)
        else:
            result = original.copy()
        
        return result.convert('RGB')


async def analyze_floor_plan(
    image_bytes: bytes,
    context: Optional[str] = None
) -> Dict:
    """
    Convenience function to analyze a floor plan.
    
    Args:
        image_bytes: Raw image bytes
        context: Optional context hint
    
    Returns:
        Analysis result dictionary
    """
    service = FloorPlanAnalyzer()
    return await service.analyze(image_bytes, context)
