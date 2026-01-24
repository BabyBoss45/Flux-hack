"""
Floor Plan Analyzer API

Simple FastAPI server for floor plan analysis.

Endpoints:
    POST /analyze - Analyze floor plan, returns JSON + image
    GET /health - Health check
"""

import os
import base64
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from dotenv import load_dotenv

from .floor_plan_analyzer import FloorPlanAnalyzer

load_dotenv()

app = FastAPI(
    title="Floor Plan Analyzer API",
    description="Analyze floor plans using RasterScan + Claude Vision API",
    version="2.0.0"
)

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


@app.get("/")
async def root():
    """API info."""
    return {
        "service": "Floor Plan Analyzer API",
        "version": "2.0.0",
        "endpoints": {
            "POST /analyze": "Analyze floor plan, returns JSON with rooms and base64 image",
            "POST /analyze/image": "Analyze floor plan, returns PNG image directly",
            "GET /health": "Health check"
        }
    }


def run_server(host: str = "0.0.0.0", port: int = 8000):
    """Run the API server."""
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
