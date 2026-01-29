'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import Konva from 'konva';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CanvasToolbar, type Tool } from './canvas-toolbar';

interface CanvasEditorProps {
  imageUrl: string;
  roomId: number;
  onImageAdded?: (imageUrl: string) => void;
  onClose?: () => void;
}

interface Stroke {
  tool: Tool;
  points: number[];
  brushSize: number;
}

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MAX_HISTORY = 20;

// Mask color: semi-transparent green for visibility
const MASK_COLOR = '#00ff9d';
const MASK_OPACITY = 0.5;

export function CanvasEditor({
  imageUrl,
  roomId,
  onImageAdded,
  onClose,
}: CanvasEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tool state
  const [currentTool, setCurrentTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [history, setHistory] = useState<Stroke[][]>([[]]);

  // Image state
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Load the background image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tool shortcuts
      if (e.key === 'b' || e.key === 'B') {
        setCurrentTool('brush');
      } else if (e.key === 'e' || e.key === 'E') {
        setCurrentTool('eraser');
      }

      // Undo/Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      }

      // Space for panning (only when not focused on an input)
      const target = e.target as HTMLElement;
      if (e.key === ' ' && !spacePressed && target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        setSpacePressed(true);
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [spacePressed, historyIndex, history]);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();

      const stage = stageRef.current;
      if (!stage) return;

      const oldScale = zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.1;
      const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
      const clampedScale = Math.min(Math.max(newScale, 0.25), 4);

      // Calculate new position to zoom to pointer
      const mousePointTo = {
        x: (pointer.x - position.x) / oldScale,
        y: (pointer.y - position.y) / oldScale,
      };

      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      };

      setZoom(clampedScale);
      setPosition(newPos);
    },
    [zoom, position]
  );

  // Get pointer position in canvas coordinates
  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    // Transform screen coordinates to canvas coordinates
    return {
      x: (pointer.x - position.x) / zoom,
      y: (pointer.y - position.y) / zoom,
    };
  }, [zoom, position]);

  // Drawing handlers
  const handleMouseDown = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      if (spacePressed) {
        setIsPanning(true);
        return;
      }

      const pos = getPointerPosition();
      if (!pos) return;

      setIsDrawing(true);
      setCurrentStroke({
        tool: currentTool,
        points: [pos.x, pos.y],
        brushSize,
      });
    },
    [currentTool, brushSize, spacePressed, getPointerPosition]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanning) {
        const stage = stageRef.current;
        if (!stage) return;

        const dx = e.evt.movementX;
        const dy = e.evt.movementY;
        setPosition((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));
        return;
      }

      if (!isDrawing || !currentStroke) return;

      const pos = getPointerPosition();
      if (!pos) return;

      setCurrentStroke({
        ...currentStroke,
        points: [...currentStroke.points, pos.x, pos.y],
      });
    },
    [isDrawing, isPanning, currentStroke, getPointerPosition]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!isDrawing || !currentStroke) return;

    setIsDrawing(false);

    // Add stroke to history
    const newStrokes = [...strokes, currentStroke];
    setStrokes(newStrokes);
    setCurrentStroke(null);

    // Update history for undo/redo
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newStrokes);
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [isDrawing, isPanning, currentStroke, strokes, history, historyIndex]);

  // History handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setStrokes(history[newIndex]);
    }
  }, [historyIndex, history]);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Export mask as white-on-black PNG
  const exportMask = useCallback((): string | null => {
    // Create an offscreen canvas for the mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = CANVAS_WIDTH;
    maskCanvas.height = CANVAS_HEIGHT;
    const ctx = maskCanvas.getContext('2d');
    if (!ctx) return null;

    // Fill with black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw strokes in white (brush) or black (eraser)
    for (const stroke of strokes) {
      if (stroke.tool === 'eraser') continue; // Skip eraser strokes for final mask

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = stroke.brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'source-over';

      ctx.beginPath();
      if (stroke.points.length >= 2) {
        ctx.moveTo(stroke.points[0], stroke.points[1]);
        for (let i = 2; i < stroke.points.length; i += 2) {
          ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
        }
      }
      ctx.stroke();
    }

    return maskCanvas.toDataURL('image/png');
  }, [strokes]);

  // Convert the loaded image to base64 using canvas
  const getImageBase64 = useCallback((): string | null => {
    if (!image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
  }, [image]);

  // Handle generate
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (strokes.length === 0) {
      alert('Please draw a mask on the area you want to edit');
      return;
    }

    const maskDataUrl = exportMask();
    if (!maskDataUrl) {
      console.error('Failed to export mask');
      return;
    }

    // Get the image base64 from the already-loaded canvas image
    const imgBase64 = getImageBase64();
    if (!imgBase64) {
      console.error('Failed to get image data');
      alert('Failed to process image');
      return;
    }

    setIsGenerating(true);

    try {
      // Convert mask data URL to base64
      const maskBase64 = maskDataUrl.split(',')[1];

      const response = await fetch('/api/images/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          image: imgBase64,
          mask: maskBase64,
          prompt: `[Inpaint] ${prompt}`,
          roomId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate image');
      }

      const data = await response.json();

      if (data.imageUrl) {
        onImageAdded?.(data.imageUrl);
        // Clear the canvas after successful generation
        handleClear();
        setPrompt('');
        onClose?.();
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate container dimensions
  const [containerSize, setContainerSize] = useState({ width: 800, height: 450 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({
          width: rect.width,
          height: rect.height - 120, // Leave room for toolbar and prompt
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Center the image initially
  useEffect(() => {
    if (imageLoaded && containerSize.width > 0) {
      const scale = Math.min(
        containerSize.width / CANVAS_WIDTH,
        containerSize.height / CANVAS_HEIGHT
      ) * 0.9;

      setZoom(scale);
      setPosition({
        x: (containerSize.width - CANVAS_WIDTH * scale) / 2,
        y: (containerSize.height - CANVAS_HEIGHT * scale) / 2,
      });
    }
  }, [imageLoaded, containerSize]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden">
      {/* Toolbar */}
      <CanvasToolbar
        currentTool={currentTool}
        onToolChange={setCurrentTool}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        zoom={zoom}
        onZoomChange={(newZoom) => {
          const scale = newZoom / zoom;
          setZoom(newZoom);
          setPosition((prev) => ({
            x: containerSize.width / 2 - (containerSize.width / 2 - prev.x) * scale,
            y: containerSize.height / 2 - (containerSize.height / 2 - prev.y) * scale,
          }));
        }}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
      />

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className="flex-1 bg-[#0d0d0d] cursor-crosshair overflow-hidden"
        style={{
          cursor: spacePressed ? 'grab' : isPanning ? 'grabbing' : 'crosshair',
        }}
      >
        {!imageLoaded ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-[#00ff9d] animate-spin" />
          </div>
        ) : (
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Layer>
              {/* Background Image */}
              {image && (
                <KonvaImage
                  image={image}
                  x={position.x}
                  y={position.y}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  scaleX={zoom}
                  scaleY={zoom}
                />
              )}

              {/* Drawn strokes */}
              {strokes.map((stroke, i) => (
                <Line
                  key={i}
                  points={stroke.points}
                  stroke={stroke.tool === 'brush' ? MASK_COLOR : '#0a0a0a'}
                  strokeWidth={stroke.brushSize}
                  opacity={stroke.tool === 'brush' ? MASK_OPACITY : 1}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                  x={position.x}
                  y={position.y}
                  scaleX={zoom}
                  scaleY={zoom}
                />
              ))}

              {/* Current stroke being drawn */}
              {currentStroke && (
                <Line
                  points={currentStroke.points}
                  stroke={currentStroke.tool === 'brush' ? MASK_COLOR : '#0a0a0a'}
                  strokeWidth={currentStroke.brushSize}
                  opacity={currentStroke.tool === 'brush' ? MASK_OPACITY : 1}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    currentStroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                  x={position.x}
                  y={position.y}
                  scaleX={zoom}
                  scaleY={zoom}
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Prompt Input Panel */}
      <div className="p-4 bg-[#0d0d0d] border-t border-white/[0.08]">
        <div className="flex gap-3">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what to generate in the masked area..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-[#00ff9d]/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            disabled={isGenerating}
          />
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || strokes.length === 0 || isGenerating}
            className="px-6 bg-[#00ff9d] hover:bg-[#00ff9d]/90 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate
              </>
            )}
          </Button>
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/20 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
          )}
        </div>
        <p className="text-xs text-white/40 mt-2">
          Draw on the image to create a mask, then describe what should appear in that area.
        </p>
      </div>
    </div>
  );
}
