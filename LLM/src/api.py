"""
Floor Plan & Furniture Analyzer API

FastAPI server for:
- Floor plan analysis (room detection)
- Furniture identification (objects, colors, styles)
- Product search (find similar items online)

Endpoints:
    POST /analyze - Analyze floor plan
    POST /analyze-furniture - Identify furniture in room images
    POST /search-products - Find where to buy similar furniture
    POST /analyze-and-shop - Combined: identify + search
    GET /health - Health check
"""

import os
import base64
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from dotenv import load_dotenv

from .floor_plan_analyzer import FloorPlanAnalyzer
from .furniture_analyzer import FurnitureAnalyzer
from .product_search import ProductSearchAgent, VisualSearchAgent

load_dotenv()

app = FastAPI(
    title="Floor Plan & Furniture Analyzer API",
    description="Analyze floor plans, identify furniture, and find products online",
    version="3.0.0"
)

# Initialize analyzers
furniture_analyzer = FurnitureAnalyzer()
product_search_agent = ProductSearchAgent()
visual_search_agent = VisualSearchAgent()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = FloorPlanAnalyzer()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def validate_image(filename: str, content: bytes) -> tuple[bool, str]:
    """Validate uploaded image file."""
    if not filename:
        return False, "No filename provided"
    
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    if len(content) > MAX_FILE_SIZE:
        return False, f"File too large. Max: {MAX_FILE_SIZE // (1024*1024)}MB"
    
    if len(content) == 0:
        return False, "Empty file"
    
    return True, "OK"


@app.get("/health")
async def health_check():
    """Check if service is running."""
    return {"status": "healthy", "service": "floor-plan-analyzer"}


@app.post("/analyze")
async def analyze_floor_plan(
    image: UploadFile = File(...),
    context: Optional[str] = Form(None)
):
    """
    Analyze a floor plan image.
    
    Args:
        image: Floor plan image file (PNG, JPEG, etc.)
        context: Optional context (e.g., "residential apartment", "office")
    
    Returns:
        JSON with:
            - status: "success" or "error"
            - rooms: List of room data with parameters
            - annotated_image_base64: Base64 PNG with room overlays
            - total_area_sqft: Total floor area
            - room_count: Number of rooms
    """
    try:
        content = await image.read()
        
        valid, message = validate_image(image.filename, content)
        if not valid:
            raise HTTPException(status_code=400, detail=message)
        
        result = await analyzer.analyze(content, context)
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze/image")
async def analyze_get_image(
    image: UploadFile = File(...),
    context: Optional[str] = Form(None)
):
    """
    Analyze floor plan and return annotated image directly.
    
    Returns PNG image with room overlays.
    """
    try:
        content = await image.read()
        
        valid, message = validate_image(image.filename, content)
        if not valid:
            raise HTTPException(status_code=400, detail=message)
        
        result = await analyzer.analyze(content, context)
        
        annotated_b64 = result.get("annotated_image_base64")
        if not annotated_b64:
            raise HTTPException(status_code=500, detail="Failed to generate image")
        
        image_bytes = base64.b64decode(annotated_b64)
        return Response(content=image_bytes, media_type="image/png")
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-furniture")
async def analyze_furniture_endpoint(
    image: UploadFile = File(...)
):
    """
    Analyze a room design image to identify furniture.
    
    Args:
        image: Room design/interior image (PNG, JPEG, etc.)
    
    Returns:
        JSON with:
            - status: "success" or "error"
            - objects: List of furniture items with colors and tags
            - overall_style: Room style/genre
            - color_palette: Dominant colors
    """
    try:
        content = await image.read()
        
        valid, message = validate_image(image.filename, content)
        if not valid:
            raise HTTPException(status_code=400, detail=message)
        
        result = furniture_analyzer.analyze(content)
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


class FurnitureObject(BaseModel):
    name: str
    category: str
    primary_color: str = ""
    secondary_colors: List[str] = []
    style_tags: List[str] = []
    material_tags: List[str] = []
    description: str = ""


@app.post("/search-products")
async def search_products_endpoint(
    furniture: FurnitureObject
):
    """
    Search for similar products online based on furniture details.
    
    Args:
        furniture: Furniture object details (name, category, colors, style)
    
    Returns:
        JSON with:
            - status: "success" or "error"
            - object: Furniture name
            - search_queries: Generated search queries
            - recommendations: List of product recommendations
    """
    try:
        result = product_search_agent.search(furniture.model_dump())
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/analyze-and-shop")
async def analyze_and_shop_endpoint(
    image: UploadFile = File(...)
):
    """
    Combined: Analyze furniture in image AND search for similar products.
    
    Args:
        image: Room design/interior image (PNG, JPEG, etc.)
    
    Returns:
        JSON with:
            - status: "success" or "error"
            - objects: List of furniture items with shopping recommendations
            - overall_style: Room style
            - color_palette: Dominant colors
    """
    try:
        content = await image.read()
        
        valid, message = validate_image(image.filename, content)
        if not valid:
            raise HTTPException(status_code=400, detail=message)
        
        # Step 1: Analyze furniture
        analysis = furniture_analyzer.analyze(content)
        
        if analysis.get("status") != "success":
            return JSONResponse(content=analysis)
        
        # Step 2: Search for real products for each object using ThorData
        objects_with_shopping = []
        for obj in analysis.get("objects", []):
            # Build search query from object details
            name = obj.get("name", "")
            category = obj.get("category", "")
            style = obj.get("style_tags", [""])[0] if obj.get("style_tags") else ""
            
            search_query = f"{style} {category}" if style else category
            
            # Use ThorData visual search for real product link
            search_result = visual_search_agent.search_products(search_query)
            
            obj_with_shopping = {
                **obj,
                "product": search_result.get("product")
            }
            objects_with_shopping.append(obj_with_shopping)
        
        # Extract object names list
        object_names = [obj.get("name") for obj in objects_with_shopping]
        
        return JSONResponse(content={
            "status": "success",
            "object_names": object_names,
            "objects": objects_with_shopping,
            "overall_style": analysis.get("overall_style"),
            "color_palette": analysis.get("color_palette", [])
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/visual-search")
async def visual_search_endpoint(
    query: str = Form(...)
):
    """
    Search for products by description using ThorData Google Search.
    
    Args:
        query: Product description (e.g., "grey fabric sofa")
    
    Returns single best matching product with real purchase link.
    """
    try:
        result = visual_search_agent.search_products(query)
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/")
async def root():
    """API info."""
    return {
        "service": "Floor Plan & Furniture Analyzer API",
        "version": "3.0.0",
        "endpoints": {
            "POST /analyze": "Analyze floor plan, returns JSON with rooms and base64 image",
            "POST /analyze/image": "Analyze floor plan, returns PNG image directly",
            "POST /analyze-furniture": "Identify furniture in room images",
            "POST /search-products": "Find where to buy similar furniture",
            "POST /analyze-and-shop": "Combined: identify furniture + search products",
            "POST /visual-search": "Visual search: find matching products via Google Lens",
            "GET /health": "Health check"
        }
    }


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the API server."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
