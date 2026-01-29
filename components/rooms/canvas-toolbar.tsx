'use client';

import { Brush, Eraser, Undo, Redo, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type Tool = 'brush' | 'eraser';

interface CanvasToolbarProps {
  currentTool: Tool;
  onToolChange: (tool: Tool) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const BRUSH_SIZES = [
  { value: 10, label: 'S' },
  { value: 30, label: 'M' },
  { value: 60, label: 'L' },
];

const ZOOM_PRESETS = [0.25, 0.5, 1, 2, 4];

export function CanvasToolbar({
  currentTool,
  onToolChange,
  brushSize,
  onBrushSizeChange,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
}: CanvasToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);

  const handleZoomIn = () => {
    const currentIndex = ZOOM_PRESETS.findIndex((z) => z >= zoom);
    const nextIndex = Math.min(currentIndex + 1, ZOOM_PRESETS.length - 1);
    onZoomChange(ZOOM_PRESETS[nextIndex === -1 ? ZOOM_PRESETS.length - 1 : nextIndex]);
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_PRESETS.findIndex((z) => z >= zoom);
    const nextIndex = Math.max((currentIndex === -1 ? ZOOM_PRESETS.length : currentIndex) - 1, 0);
    onZoomChange(ZOOM_PRESETS[nextIndex]);
  };

  const handleResetZoom = () => {
    onZoomChange(1);
  };

  return (
    <div className="flex items-center gap-4 p-3 bg-[#0d0d0d] border-b border-white/[0.08] rounded-t-xl">
      {/* Tool Selection */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToolChange('brush')}
          className={`h-8 w-8 p-0 ${
            currentTool === 'brush'
              ? 'bg-[#00ff9d]/20 text-[#00ff9d]'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Brush (B)"
        >
          <Brush className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToolChange('eraser')}
          className={`h-8 w-8 p-0 ${
            currentTool === 'eraser'
              ? 'bg-[#00ff9d]/20 text-[#00ff9d]'
              : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Eraser (E)"
        >
          <Eraser className="w-4 h-4" />
        </Button>
      </div>

      {/* Brush Size */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Size</span>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {BRUSH_SIZES.map(({ value, label }) => (
            <Button
              key={value}
              variant="ghost"
              size="sm"
              onClick={() => onBrushSizeChange(value)}
              className={`h-7 min-w-7 px-2 text-xs ${
                brushSize === value
                  ? 'bg-[#00ff9d]/20 text-[#00ff9d]'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Undo/Redo/Clear */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onUndo}
          disabled={!canUndo}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Cmd+Z)"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={!canRedo}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 w-8 p-0 text-white/60 hover:text-red-400 hover:bg-red-400/10"
          title="Clear mask"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-white/10" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoom <= ZOOM_PRESETS[0]}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <button
          onClick={handleResetZoom}
          className="min-w-12 h-7 px-2 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors"
          title="Reset zoom"
        >
          {zoomPercent}%
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="ml-auto text-[10px] text-white/30">
        B: Brush | E: Eraser | Scroll: Zoom | Space+Drag: Pan
      </div>
    </div>
  );
}
