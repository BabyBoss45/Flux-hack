"""
Furniture Analyzer Service

Analyzes room design images to identify furniture objects, their colors, and styles.

Input: Room design/interior image (PNG, JPEG, etc.)
Output: 
  - List of furniture objects with tags
  - Hex color codes for each object
  - Genre/style classification
"""

import base64
import io
import json
import re
import os
from typing import Dict, List, Optional
from PIL import Image
import anthropic
from dotenv import load_dotenv


load_dotenv()


class FurnitureAnalyzer:
    """
    Analyzes room design images to identify furniture and decor items.
    
    Usage:
        analyzer = FurnitureAnalyzer()
        result = analyzer.analyze(image_bytes)
        
        # result contains:
        # - "objects": list of furniture items with colors and tags
        # - "overall_style": room genre/style
        # - "color_palette": dominant colors in the room
    """
    
    def __init__(self, claude_api_key: Optional[str] = None):
        self.claude_api_key = claude_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = "claude-sonnet-4-20250514"
        
        if self.claude_api_key:
            self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        else:
            self.claude_client = None
    
    def analyze(self, image_bytes: bytes) -> Dict:
        """
        Analyze a room design image.
        
        Args:
            image_bytes: Raw image bytes (PNG, JPEG, etc.)
        
        Returns:
            Dict with:
                - status: "success" or "error"
                - objects: List of furniture items with details
                - overall_style: Room genre/style
                - color_palette: Dominant colors
        """
        try:
            image = Image.open(io.BytesIO(image_bytes))
            width, height = image.size
            
            # Detect image format for correct media type
            img_format = image.format or "PNG"
            media_type = f"image/{img_format.lower()}"
            if media_type == "image/jpg":
                media_type = "image/jpeg"
            
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            analysis = self._analyze_with_claude(image_base64, width, height, media_type)
            
            return {
                "status": "success",
                **analysis
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "objects": [],
                "overall_style": None,
                "color_palette": []
            }
    
    def _analyze_with_claude(
        self, 
        image_base64: str, 
        width: int, 
        height: int,
        media_type: str = "image/png"
    ) -> Dict:
        """Extract furniture information using Claude Vision API."""
        if not self.claude_client:
            return {
                "objects": [],
                "overall_style": None,
                "color_palette": []
            }
        
        prompt = f"""Analyze this room design/interior image ({width}x{height} pixels).

Identify ONLY the MAIN furniture pieces (max 5-6 items). Focus on:
- Large furniture: sofas, beds, tables, chairs, cabinets, desks
- Skip small items: candles, books, small plants, decorative bowls, throw pillows

For each main object provide:
1. name: Object name (e.g., "Sofa", "Coffee Table", "Bed")
2. category: Type (bed, sofa, chair, table, desk, lamp, rug, cabinet, shelf)
3. primary_color: Main color as hex code (e.g., "#8B4513")
4. style_tags: Style descriptors (modern, vintage, minimalist, rustic, industrial, scandinavian, bohemian)
5. material_tags: Materials (wood, metal, fabric, leather, glass)
6. description: Brief visual description for shopping search

Also provide:
- overall_style: The overall room style
- color_palette: Top 3 dominant colors

Return ONLY valid JSON:

{{
  "objects": [
    {{
      "name": "Three-Seat Sofa",
      "category": "sofa",
      "primary_color": "#A0937D",
      "style_tags": ["rustic", "traditional"],
      "material_tags": ["fabric"],
      "description": "Beige fabric three-seat sofa with rolled arms"
    }}
  ],
  "overall_style": "Rustic Traditional",
  "color_palette": [
    {{"color": "#A0937D", "name": "Warm Grey"}},
    {{"color": "#8B4513", "name": "Brown"}}
  ]
}}

Only include 5-6 main furniture pieces, not small decor."""

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
                                "media_type": media_type,
                                "data": image_base64
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }]
            )
            
            response_text = response.content[0].text.strip()
            
            if response_text.startswith("```"):
                response_text = re.sub(r'^```\w*\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            data = json.loads(response_text)
            objects = data.get("objects", [])
            
            # Filter to only keep real furniture items (not abstract or unclear)
            valid_categories = {
                "sofa", "couch", "chair", "armchair", "table", "desk", "bed", 
                "lamp", "rug", "cabinet", "shelf", "dresser", "nightstand",
                "bookshelf", "ottoman", "bench", "stool", "wardrobe", "mirror"
            }
            
            verified_objects = []
            for obj in objects:
                category = obj.get("category", "").lower()
                name = obj.get("name", "").lower()
                
                # Check if it's a real furniture category
                is_valid = any(cat in category or cat in name for cat in valid_categories)
                
                if is_valid and obj.get("primary_color"):
                    verified_objects.append(obj)
            
            return {
                "objects": verified_objects,
                "overall_style": data.get("overall_style"),
                "color_palette": data.get("color_palette", [])
            }
            
        except Exception as e:
            print(f"Claude error: {e}")
            return {
                "objects": [],
                "overall_style": None,
                "color_palette": []
            }


def analyze_furniture(image_bytes: bytes) -> Dict:
    """
    Convenience function to analyze furniture in an image.
    
    Args:
        image_bytes: Raw image bytes
    
    Returns:
        Analysis result dictionary
    """
    analyzer = FurnitureAnalyzer()
    return analyzer.analyze(image_bytes)
