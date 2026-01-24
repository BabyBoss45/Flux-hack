"""
Product Search Service

Searches the internet for similar furniture items using visual search.

Input: Furniture image or object details
Output: 
  - Single best matching product with purchase link
  - Found via Google Lens visual search (SerpApi)
"""

import os
import json
import re
import base64
import requests
from typing import Dict, List, Optional
import anthropic
from dotenv import load_dotenv


load_dotenv()


class VisualSearchAgent:
    """
    Uses ThorData ScraperAPI for Google Shopping visual search.
    
    Requires THORDATA_API_KEY in .env file.
    """
    
    def __init__(self):
        self.api_key = os.getenv("THORDATA_API_KEY", "1343027dc933c157df9a487525ab976c")
        self.base_url = "https://scraperapi.thordata.com/request"
    
    def search_products(self, query: str) -> Dict:
        """
        Search Google for products matching query.
        
        Args:
            query: Search query (e.g., "grey fabric sofa buy")
        
        Returns:
            Best matching product with link
        """
        try:
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            # Use regular Google search with "buy" keyword
            data = {
                "engine": "google",
                "q": f"{query} buy",
                "json": "1"
            }
            
            response = requests.post(self.base_url, headers=headers, data=data, timeout=30)
            result = response.json()
            
            # Check for shopping results first (has prices)
            shopping = result.get("shopping_results", []) or result.get("popular_products", [])
            if shopping:
                best = shopping[0]
                print(f"Shopping result keys: {list(best.keys())}")
                print(f"Shopping result sample: {json.dumps(best)[:500]}")
                
                # Try multiple link fields
                link = best.get("link") or best.get("product_link") or best.get("url") or best.get("serpapi_link") or ""
                
                # If still no link, construct Google Shopping search URL
                if not link and best.get("title"):
                    search_title = best.get("title", "").replace(" ", "+")
                    link = f"https://www.google.com/search?tbm=shop&q={search_title}"
                
                return {
                    "product": {
                        "title": best.get("title", ""),
                        "link": link,
                        "price": best.get("price", best.get("extracted_price", "Price not available")),
                        "source": best.get("source", best.get("merchant", "")),
                        "rating": best.get("rating"),
                        "thumbnail": best.get("thumbnail", "")
                    }
                }
            
            # Fallback to organic results
            organic = result.get("organic", []) or result.get("organic_results", [])
            if organic:
                best = organic[0]
                return {
                    "product": {
                        "title": best.get("title", ""),
                        "link": best.get("link", ""),
                        "price": "Visit site for price",
                        "source": best.get("displayed_link", ""),
                        "snippet": best.get("snippet", "")
                    }
                }
            
            return {"product": None, "message": "No products found"}
            
        except Exception as e:
            print(f"ThorData error: {e}")
            return {"error": str(e), "product": None}
    
    def search_by_image_url(self, image_url: str) -> Dict:
        """
        Search using Google Lens with image URL.
        """
        try:
            headers = {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            data = {
                "engine": "google_lens",
                "url": image_url,
                "json": "1"
            }
            
            response = requests.post(self.base_url, headers=headers, data=data, timeout=30)
            result = response.json()
            
            print(f"Google Lens response: {json.dumps(result)[:500]}")
            
            # Get visual matches or products
            products = result.get("visual_matches", []) or result.get("products", [])
            
            if products:
                best = products[0]
                return {
                    "product": {
                        "title": best.get("title", ""),
                        "link": best.get("link", ""),
                        "source": best.get("source", ""),
                        "price": best.get("price"),
                        "thumbnail": best.get("thumbnail", "")
                    }
                }
            
            return {"product": None, "message": "No visual matches found"}
            
        except Exception as e:
            print(f"Google Lens error: {e}")
            return {"error": str(e), "product": None}
    
    def search_by_image_base64(self, image_base64: str) -> Dict:
        """
        Upload image and search using Google Lens.
        """
        try:
            # Upload to imgbb
            upload_url = "https://api.imgbb.com/1/upload"
            upload_data = {
                "key": "d36eb6591370ae7f9089d85875571701",  # Free imgbb key
                "image": image_base64
            }
            
            upload_response = requests.post(upload_url, data=upload_data, timeout=30)
            upload_result = upload_response.json()
            
            print(f"Upload result: {upload_result.get('success')}")
            
            if upload_result.get("success") and upload_result.get("data", {}).get("url"):
                image_url = upload_result["data"]["url"]
                print(f"Image uploaded: {image_url}")
                return self.search_by_image_url(image_url)
            else:
                print(f"Upload failed: {upload_result}")
                return {"error": "Failed to upload image", "product": None}
                
        except Exception as e:
            print(f"Upload error: {e}")
            return {"error": str(e), "product": None}


class ProductSearchAgent:
    """
    Searches for similar furniture products online.
    
    Uses Claude to generate search queries and analyze product matches.
    
    Usage:
        agent = ProductSearchAgent()
        results = agent.search(furniture_object)
    """
    
    def __init__(self, claude_api_key: Optional[str] = None):
        self.claude_api_key = claude_api_key or os.getenv("ANTHROPIC_API_KEY")
        self.model = "claude-sonnet-4-20250514"
        
        if self.claude_api_key:
            self.claude_client = anthropic.Anthropic(api_key=self.claude_api_key)
        else:
            self.claude_client = None
        
        # Popular furniture retailers
        self.retailers = [
            {"name": "IKEA", "domain": "ikea.com"},
            {"name": "Wayfair", "domain": "wayfair.com"},
            {"name": "West Elm", "domain": "westelm.com"},
            {"name": "CB2", "domain": "cb2.com"},
            {"name": "Target", "domain": "target.com"},
            {"name": "Amazon", "domain": "amazon.com"},
            {"name": "Pottery Barn", "domain": "potterybarn.com"},
            {"name": "Crate & Barrel", "domain": "crateandbarrel.com"},
            {"name": "Article", "domain": "article.com"},
            {"name": "AllModern", "domain": "allmodern.com"},
        ]
    
    def search(self, furniture_object: Dict) -> Dict:
        """
        Search for similar products based on furniture object details.
        
        Args:
            furniture_object: Dict with name, category, colors, style_tags, etc.
        
        Returns:
            Dict with search results and product recommendations
        """
        try:
            # Generate search queries
            search_queries = self._generate_search_queries(furniture_object)
            
            # Get product recommendations from Claude
            recommendations = self._get_recommendations(furniture_object, search_queries)
            
            return {
                "status": "success",
                "object": furniture_object.get("name", "Unknown"),
                "search_queries": search_queries,
                "recommendations": recommendations
            }
            
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "object": furniture_object.get("name", "Unknown"),
                "search_queries": [],
                "recommendations": []
            }
    
    def search_all(self, furniture_objects: List[Dict]) -> List[Dict]:
        """
        Search for products for multiple furniture objects.
        
        Args:
            furniture_objects: List of furniture object dicts
        
        Returns:
            List of search results for each object
        """
        results = []
        for obj in furniture_objects:
            result = self.search(obj)
            results.append(result)
        return results
    
    def _generate_search_queries(self, furniture_object: Dict) -> List[str]:
        """Generate search queries based on furniture details."""
        name = furniture_object.get("name", "")
        category = furniture_object.get("category", "")
        style_tags = furniture_object.get("style_tags", [])
        material_tags = furniture_object.get("material_tags", [])
        primary_color = furniture_object.get("primary_color", "")
        
        # Convert hex to color name
        color_name = self._hex_to_color_name(primary_color)
        
        queries = []
        
        # Basic query
        queries.append(f"{name} {category}")
        
        # Style-based query
        if style_tags:
            queries.append(f"{style_tags[0]} {category}")
        
        # Color + style query
        if color_name and style_tags:
            queries.append(f"{color_name} {style_tags[0]} {category}")
        
        # Material-based query
        if material_tags:
            queries.append(f"{material_tags[0]} {category}")
        
        # Full descriptive query
        full_query_parts = []
        if color_name:
            full_query_parts.append(color_name)
        if style_tags:
            full_query_parts.append(style_tags[0])
        if material_tags:
            full_query_parts.append(material_tags[0])
        full_query_parts.append(category)
        queries.append(" ".join(full_query_parts))
        
        return list(set(queries))  # Remove duplicates
    
    def _hex_to_color_name(self, hex_color: str) -> str:
        """Convert hex color to approximate color name."""
        if not hex_color or not hex_color.startswith("#"):
            return ""
        
        # Basic color mapping
        color_map = {
            "#FFFFFF": "white",
            "#000000": "black",
            "#808080": "grey",
            "#C0C0C0": "silver",
            "#FF0000": "red",
            "#00FF00": "green",
            "#0000FF": "blue",
            "#FFFF00": "yellow",
            "#FFA500": "orange",
            "#800080": "purple",
            "#FFC0CB": "pink",
            "#A52A2A": "brown",
            "#8B4513": "brown",
            "#D2691E": "brown",
            "#F5DEB3": "beige",
            "#DEB887": "tan",
            "#2C3E50": "navy",
            "#1ABC9C": "teal",
            "#E74C3C": "red",
            "#3498DB": "blue",
            "#2ECC71": "green",
            "#F39C12": "gold",
            "#9B59B6": "purple",
            "#34495E": "charcoal",
            "#ECF0F1": "off-white",
            "#95A5A6": "grey",
        }
        
        hex_upper = hex_color.upper()
        if hex_upper in color_map:
            return color_map[hex_upper]
        
        # Parse RGB and determine closest basic color
        try:
            hex_clean = hex_color.lstrip('#')
            r = int(hex_clean[0:2], 16)
            g = int(hex_clean[2:4], 16)
            b = int(hex_clean[4:6], 16)
            
            # Simple color classification
            if r > 200 and g > 200 and b > 200:
                return "white"
            elif r < 50 and g < 50 and b < 50:
                return "black"
            elif r > 150 and g < 100 and b < 100:
                return "red"
            elif r < 100 and g > 150 and b < 100:
                return "green"
            elif r < 100 and g < 100 and b > 150:
                return "blue"
            elif r > 150 and g > 150 and b < 100:
                return "yellow"
            elif r > 150 and g > 100 and b < 100:
                return "orange"
            elif r > 100 and g < 100 and b > 100:
                return "purple"
            elif r > 100 and g > 80 and b < 80:
                return "brown"
            elif abs(r - g) < 30 and abs(g - b) < 30:
                return "grey"
            else:
                return "neutral"
        except:
            return ""
    
    def _get_recommendations(
        self, 
        furniture_object: Dict, 
        search_queries: List[str]
    ) -> List[Dict]:
        """Get product recommendations using Claude."""
        if not self.claude_client:
            return []
        
        name = furniture_object.get("name", "Unknown")
        category = furniture_object.get("category", "furniture")
        description = furniture_object.get("description", "")
        style_tags = furniture_object.get("style_tags", [])
        material_tags = furniture_object.get("material_tags", [])
        primary_color = furniture_object.get("primary_color", "")
        
        # Build search query from furniture details
        color_name = self._hex_to_color_name(primary_color)
        
        search_terms = []
        if color_name:
            search_terms.append(color_name)
        if style_tags:
            search_terms.append(style_tags[0])
        if material_tags:
            search_terms.append(material_tags[0])
        search_terms.append(category)
        
        base_query = " ".join(search_terms)
        
        prompt = f"""Create 3 SHORT search queries (2-4 words max) to find this furniture:

**Item:** {name}
- Category: {category}
- Color: {color_name or 'neutral'}
- Style: {', '.join(style_tags[:1]) if style_tags else ''}

For each, provide:
1. search_query: SHORT search (2-4 words only, e.g. "gray fabric sofa" or "wood coffee table")
2. store: Retailer (IKEA, Wayfair, Amazon, Target)
3. price_range: Price estimate

Return ONLY valid JSON:

{{
  "recommendations": [
    {{"search_query": "gray fabric sofa", "store": "Wayfair", "price_range": "$500-$900"}},
    {{"search_query": "grey couch", "store": "Amazon", "price_range": "$400-$800"}},
    {{"search_query": "fabric sofa", "store": "IKEA", "price_range": "$300-$600"}}
  ]
}}

IMPORTANT: Keep search queries SHORT (2-4 words). No long phrases."""

        try:
            response = self.claude_client.messages.create(
                model=self.model,
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            response_text = response.content[0].text.strip()
            
            if response_text.startswith("```"):
                response_text = re.sub(r'^```\w*\n?', '', response_text)
                response_text = re.sub(r'\n?```$', '', response_text)
            
            data = json.loads(response_text)
            recommendations = data.get("recommendations", [])
            
            # Generate real search URLs for each recommendation
            store_urls = {
                "IKEA": "https://www.ikea.com/us/en/search/?q=",
                "Wayfair": "https://www.wayfair.com/keyword.html?keyword=",
                "Amazon": "https://www.amazon.com/s?k=",
                "Target": "https://www.target.com/s?searchTerm=",
                "West Elm": "https://www.westelm.com/search/?q=",
                "Walmart": "https://www.walmart.com/search?q=",
                "Google Shopping": "https://www.google.com/search?tbm=shop&q=",
            }
            
            for rec in recommendations:
                query = rec.get("search_query", "")
                store = rec.get("store", "Google Shopping")
                
                # URL encode the query
                encoded_query = query.replace(" ", "+")
                
                # Get the store's search URL
                base_url = store_urls.get(store, store_urls["Google Shopping"])
                rec["url"] = f"{base_url}{encoded_query}"
            
            return recommendations
            
        except Exception as e:
            print(f"Claude error in product search: {e}")
            return []


def search_products(furniture_object: Dict) -> Dict:
    """
    Convenience function to search for similar products.
    
    Args:
        furniture_object: Furniture details dict
    
    Returns:
        Search results dictionary
    """
    agent = ProductSearchAgent()
    return agent.search(furniture_object)


def search_all_products(furniture_objects: List[Dict]) -> List[Dict]:
    """
    Search for products for multiple furniture objects.
    
    Args:
        furniture_objects: List of furniture object dicts
    
    Returns:
        List of search results
    """
    agent = ProductSearchAgent()
    return agent.search_all(furniture_objects)
