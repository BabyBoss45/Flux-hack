"""
Button Position Analyzer

Separate LLM service to extract room button coordinates from annotated floor plan images.
This analyzes the visual output and identifies where room labels are positioned
for accurate button placement on the frontend.
"""

import os
import json
import re
from typing import List, Dict, Optional
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()


class ButtonPositionAnalyzer:
    """
    Analyzes annotated floor plan images to extract precise button positions
    for frontend overlay.
    
    Usage:
        analyzer = ButtonPositionAnalyzer()
        buttons = analyzer.analyze(annotated_image_base64, rooms_data, width, height)
        
        # buttons contains list of:
        # - x_percent: Horizontal position (0-100%)
        # - y_percent: Vertical position (0-100%)
        # - room_data: Full room JSON object
    """
    
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY")
        self.client = Anthropic(api_key=self.api_key) if self.api_key else None
        self.model = "claude-sonnet-4-20250514"
    
    def analyze(
        self, 
        annotated_image_base64: str, 
        rooms_data: List[Dict],
        width: int,
        height: int
    ) -> List[Dict]:
        """
        Extract button positions from annotated floor plan image.
        
        Args:
            annotated_image_base64: Base64 encoded annotated floor plan PNG
            rooms_data: List of room data from floor plan analysis
            width: Image width in pixels
            height: Image height in pixels
        
        Returns:
            List of button objects with:
            - x_percent: Horizontal position (0-100%)
            - y_percent: Vertical position (0-100%)
            - room_data: Full room JSON object
        """
        if not self.client:
            print("Warning: ANTHROPIC_API_KEY not configured for button positioning")
            return self._fallback_positions(rooms_data, width, height)
        
        # Filter out small rooms (closets, small storage)
        MIN_AREA_SQFT = 30  # Only include rooms >= 30 sq ft
        EXCLUDED_TYPES = ['closet', 'storage']  # Exclude these room types
        IMPORTANT_TYPES = ['bathroom', 'kitchen', 'bedroom', 'living_room', 'dining_room']  # Always include these
        
        filtered_rooms = [
            r for r in rooms_data 
            if (r.get('area_sqft', 0) >= MIN_AREA_SQFT or r.get('type', '') in IMPORTANT_TYPES)
            and r.get('type', '') not in EXCLUDED_TYPES
        ]
        
        if not filtered_rooms:
            print("No rooms meet minimum area requirement")
            return []
        
        try:
            # Build room names list for the prompt
            room_names = [r.get('name', '') for r in filtered_rooms]
            room_list = ", ".join(f'"{name}"' for name in room_names if name)
            
            prompt = f"""Analyze this annotated floor plan image ({width}x{height} pixels).

The image shows colored room overlays with room names/labels written on them.

Expected room names: {room_list}

IMPORTANT: Look for ALL room labels including small text labels. Some rooms like bathrooms may have smaller or less prominent labels - make sure to include them.

For EACH visible room label/name text in the image, identify:
1. room_name: The exact text of the room label as it appears (e.g., "LIVING ROOM", "BEDROOM", "KITCHEN", "BATHROOM")
2. x: Center X coordinate of where the label text is positioned (0 to {width} pixels)
3. y: Center Y coordinate of where the label text is positioned (0 to {height} pixels)

The coordinates should point to the CENTER of each room's label text.

Return ONLY valid JSON (no markdown, no explanation):

{{
  "buttons": [
    {{"room_name": "LIVING ROOM", "x": 350, "y": 400}},
    {{"room_name": "BEDROOM", "x": 800, "y": 250}},
    {{"room_name": "KITCHEN", "x": 150, "y": 150}},
    {{"room_name": "BATHROOM", "x": 600, "y": 200}}
  ]
}}

Include ALL room labels you can see in the image, even if the text is small or faint. Match the names exactly as they appear.
Do NOT skip rooms - if you see a colored room area, look carefully for its label."""

            response = self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": annotated_image_base64
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
            buttons = self._process_button_data(
                data.get("buttons", []),
                filtered_rooms,
                width,
                height
            )
            
            # Add fallback buttons for rooms that weren't detected by LLM
            # Use flexible matching to avoid duplicates (e.g., "Bedroom" vs "Master Bedroom")
            detected_room_names = {btn['room_data']['name'].upper() for btn in buttons}
            detected_room_types = {}
            for btn in buttons:
                room_type = btn['room_data'].get('type', '')
                if room_type not in detected_room_types:
                    detected_room_types[room_type] = []
                detected_room_types[room_type].append(btn['room_data']['name'].upper())
            
            missing_rooms = []
            for room in filtered_rooms:
                room_name = room.get('name', '').upper()
                room_type = room.get('type', '')
                
                # Skip if exact name match
                if room_name in detected_room_names:
                    continue
                
                # Skip if partial name match (e.g., "BEDROOM" in "MASTER BEDROOM")
                is_partial_match = False
                for detected_name in detected_room_names:
                    if room_name in detected_name or detected_name in room_name:
                        is_partial_match = True
                        break
                
                if not is_partial_match:
                    missing_rooms.append(room)
            
            if missing_rooms:
                print(f"Adding fallback buttons for {len(missing_rooms)} undetected rooms")
                fallback_buttons = self._create_fallback_buttons(missing_rooms, width, height)
                buttons.extend(fallback_buttons)
            
            # Check and fix overlapping buttons
            buttons = self._fix_overlapping_buttons(buttons)
            
            print(f"Button positions extracted: {len(buttons)} buttons (filtered from {len(rooms_data)} total rooms)")
            return buttons
            
        except Exception as e:
            print(f"Button position analysis error: {e}")
            return self._fallback_positions(rooms_data, width, height)
    
    def _process_button_data(
        self,
        button_coords: List[Dict],
        rooms_data: List[Dict],
        width: int,
        height: int
    ) -> List[Dict]:
        """Convert pixel coordinates to percentage-based positions and include full room data."""
        buttons = []
        
        for btn in button_coords:
            room_name = btn.get('room_name', '')
            x = btn.get('x', 0)
            y = btn.get('y', 0)
            
            # Find matching room data (case-insensitive, flexible matching)
            room_info = self._find_matching_room(room_name, rooms_data)
            
            # Skip if no matching room found in filtered list
            # This filters out small rooms (closets) that LLM detected but we excluded
            if not room_info:
                print(f"  Skipping button '{room_name}' - not in filtered room list")
                continue
            
            # Convert to percentages for responsive frontend
            x_percent = round((x / width) * 100, 2) if width > 0 else 50
            y_percent = round((y / height) * 100, 2) if height > 0 else 50
            
            # Clamp to valid range
            x_percent = max(0, min(100, x_percent))
            y_percent = max(0, min(100, y_percent))
            
            # Include positioning and full room data
            buttons.append({
                "x_percent": x_percent,
                "y_percent": y_percent,
                "room_data": room_info
            })
        
        return buttons
    
    def _find_matching_room(self, room_name: str, rooms_data: List[Dict]) -> Optional[Dict]:
        """Find room data matching the given name (flexible matching)."""
        room_name_upper = room_name.upper().strip()
        
        # Exact match first
        for room in rooms_data:
            if room.get('name', '').upper().strip() == room_name_upper:
                return room
        
        # Partial match (room name contains or is contained)
        for room in rooms_data:
            room_stored = room.get('name', '').upper().strip()
            if room_name_upper in room_stored or room_stored in room_name_upper:
                return room
        
        # Match by type keyword
        type_keywords = {
            'LIVING': 'living_room',
            'BEDROOM': 'bedroom',
            'MASTER': 'bedroom',
            'KITCHEN': 'kitchen',
            'DINING': 'dining_room',
            'BATH': 'bathroom',
            'CLOSET': 'closet',
            'OFFICE': 'office',
            'GARAGE': 'garage',
            'HALLWAY': 'hallway',
            'ENTRANCE': 'entrance'
        }
        
        for keyword, room_type in type_keywords.items():
            if keyword in room_name_upper:
                for room in rooms_data:
                    if room.get('type') == room_type:
                        return room
        
        return None
    
    def _fix_overlapping_buttons(self, buttons: List[Dict]) -> List[Dict]:
        """
        Detect and fix overlapping buttons by adjusting their positions.
        Assumes average button size of ~15% width x 8% height.
        """
        BUTTON_WIDTH = 15.0  # Approximate button width in percentage
        BUTTON_HEIGHT = 8.0  # Approximate button height in percentage
        MIN_SPACING = 2.0    # Minimum spacing between buttons
        
        fixed_buttons = []
        
        for i, button in enumerate(buttons):
            x = button['x_percent']
            y = button['y_percent']
            
            # Check for overlaps with already placed buttons
            overlaps = True
            attempts = 0
            max_attempts = 20
            
            while overlaps and attempts < max_attempts:
                overlaps = False
                
                for placed_button in fixed_buttons:
                    px = placed_button['x_percent']
                    py = placed_button['y_percent']
                    
                    # Calculate distance between button centers
                    dx = abs(x - px)
                    dy = abs(y - py)
                    
                    # Check if buttons overlap (with spacing)
                    if dx < (BUTTON_WIDTH + MIN_SPACING) and dy < (BUTTON_HEIGHT + MIN_SPACING):
                        overlaps = True
                        
                        # Adjust position - move away from overlapping button
                        if dx < dy:
                            # Move horizontally
                            if x < px:
                                x = max(5.0, x - 10.0)
                            else:
                                x = min(95.0, x + 10.0)
                        else:
                            # Move vertically
                            if y < py:
                                y = max(5.0, y - 10.0)
                            else:
                                y = min(95.0, y + 10.0)
                        
                        print(f"  Adjusting '{button['room_data']['name']}' to avoid overlap: ({x:.1f}%, {y:.1f}%)")
                        break
                
                attempts += 1
            
            # Update button position
            button['x_percent'] = round(x, 2)
            button['y_percent'] = round(y, 2)
            fixed_buttons.append(button)
        
        return fixed_buttons
    
    def _create_fallback_buttons(
        self,
        rooms: List[Dict],
        width: int,
        height: int
    ) -> List[Dict]:
        """
        Create buttons for rooms that weren't detected by LLM.
        Uses room dimensions and area to estimate better positions.
        """
        buttons = []
        
        # Calculate positions based on room area distribution
        # Larger rooms typically in center/bottom, smaller rooms at edges
        total_area = sum(r.get('area_sqft', 0) for r in rooms)
        
        for i, room in enumerate(rooms):
            room_type = room.get('type', 'other')
            room_area = room.get('area_sqft', 0)
            
            # Better positioning based on room type and relative size
            if room_type == 'bathroom':
                # Bathrooms typically near bedrooms, upper area
                x_percent = 50.0
                y_percent = 20.0
            elif room_type == 'kitchen':
                # Kitchens typically top-left or top-right
                x_percent = 15.0
                y_percent = 15.0
            elif room_type == 'dining_room':
                # Dining rooms near kitchen
                x_percent = 40.0
                y_percent = 15.0
            elif room_type == 'bedroom':
                # Bedrooms distributed, larger ones (master) lower
                if room_area > 150:  # Master bedroom
                    x_percent = 65.0
                    y_percent = 65.0
                else:
                    x_percent = 75.0
                    y_percent = 15.0
            elif room_type == 'living_room':
                # Living rooms typically larger, center-left
                x_percent = 30.0
                y_percent = 50.0
            else:
                # Default positioning for other room types
                x_percent = 50.0
                y_percent = 50.0
            
            print(f"  Creating fallback button for '{room.get('name')}' ({room_type}, {room_area} sq ft) at ({x_percent}%, {y_percent}%)")
            
            buttons.append({
                "x_percent": x_percent,
                "y_percent": y_percent,
                "room_data": room
            })
        
        return buttons
    
    def _fallback_positions(
        self,
        rooms_data: List[Dict],
        width: int,
        height: int
    ) -> List[Dict]:
        """
        Fallback: Generate approximate button positions
        when LLM analysis is not available.
        """
        buttons = []
        
        for i, room in enumerate(rooms_data):
            # Simple grid layout fallback
            cols = 3
            row = i // cols
            col = i % cols
            
            x_percent = 20 + (col * 30)
            y_percent = 20 + (row * 25)
            
            buttons.append({
                "x_percent": x_percent,
                "y_percent": y_percent,
                "room_data": room
            })
        
        return buttons


def analyze_button_positions(
    annotated_image_base64: str,
    rooms_data: List[Dict],
    width: int,
    height: int
) -> List[Dict]:
    """
    Convenience function to analyze button positions.
    
    Args:
        annotated_image_base64: Base64 encoded annotated floor plan PNG
        rooms_data: List of room data from floor plan analysis
        width: Image width in pixels
        height: Image height in pixels
    
    Returns:
        List of button objects with positioning and room data
    """
    analyzer = ButtonPositionAnalyzer()
    return analyzer.analyze(annotated_image_base64, rooms_data, width, height)
