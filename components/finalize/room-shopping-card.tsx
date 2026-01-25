'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ProductInfo {
  title: string;
  link: string;
  price: string;
  source?: string;
  thumbnail?: string;
  rating?: number;
}

export interface FurnitureObject {
  name: string;
  category: string;
  primary_color: string;
  style_tags?: string[];
  material_tags?: string[];
  description?: string;
  product: ProductInfo | null;
}

export interface RoomAnalysis {
  status: 'success' | 'error' | 'loading' | 'idle';
  object_names?: string[];
  total_price?: string;
  objects?: FurnitureObject[];
  overall_style?: string;
  color_palette?: Array<{ color: string; name: string }>;
  error?: string;
}

interface RoomShoppingCardProps {
  roomId: number;
  roomName: string;
  imageUrl: string;
  analysis: RoomAnalysis;
  onAnalyze: () => void;
}

export function RoomShoppingCard({
  roomName,
  imageUrl,
  analysis,
  onAnalyze,
}: RoomShoppingCardProps) {
  const [imageError, setImageError] = useState(false);

  const isLoading = analysis.status === 'loading';
  const hasData = analysis.status === 'success' && analysis.objects;
  const hasError = analysis.status === 'error';
  const isIdle = analysis.status === 'idle';

  return (
    <div className="panel overflow-hidden">
      {/* Room Image */}
      <div className="relative aspect-video bg-white/5">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={roomName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            No image available
          </div>
        )}
        
        {/* Room name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <h3 className="text-lg font-semibold text-white">{roomName}</h3>
          {analysis.overall_style && (
            <p className="text-sm text-white/70">{analysis.overall_style}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Idle state - show analyze button */}
        {isIdle && (
          <div className="text-center py-4">
            <p className="text-sm text-white/60 mb-3">
              Analyze this room to find matching furniture
            </p>
            <Button
              onClick={onAnalyze}
              className="bg-accent-warm hover:bg-accent-warm/90"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Analyze & Shop
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent-warm" />
            <p className="text-sm text-white/60">Analyzing furniture...</p>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex flex-col items-center justify-center py-4 gap-3">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{analysis.error || 'Analysis failed'}</p>
            <Button
              onClick={onAnalyze}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Success state - show furniture list */}
        {hasData && analysis.objects && (
          <div className="space-y-3">
            {/* Color palette */}
            {analysis.color_palette && analysis.color_palette.length > 0 && (
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <span className="text-xs text-white/50">Colors:</span>
                <div className="flex gap-1">
                  {analysis.color_palette.map((c, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: c.color }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Furniture items */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {analysis.objects.map((obj, index) => (
                <FurnitureItem key={index} object={obj} />
              ))}
            </div>

            {/* Room total */}
            {analysis.total_price && analysis.total_price !== 'N/A' && (
              <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                <span className="text-sm text-white/70">Room Total:</span>
                <span className="text-lg font-semibold text-accent-warm">
                  {analysis.total_price}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FurnitureItem({ object }: { object: FurnitureObject }) {
  const hasProduct = object.product && object.product.link;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      {/* Color indicator */}
      <div
        className="w-8 h-8 rounded-lg border border-white/20 flex-shrink-0"
        style={{ backgroundColor: object.primary_color }}
      />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white truncate">{object.name}</p>
            <p className="text-xs text-white/50 capitalize">{object.category}</p>
          </div>
          
          {/* Price */}
          {object.product?.price && (
            <span className="text-sm font-semibold text-green-400 whitespace-nowrap">
              {object.product.price}
            </span>
          )}
        </div>

        {/* Tags */}
        {(object.style_tags?.length || object.material_tags?.length) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {object.style_tags?.slice(0, 2).map((tag, i) => (
              <span key={`s-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-warm/20 text-accent-warm">
                {tag}
              </span>
            ))}
            {object.material_tags?.slice(0, 1).map((tag, i) => (
              <span key={`m-${i}`} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Product link */}
        {hasProduct && object.product && (
          <a
            href={object.product.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-accent-warm hover:underline"
          >
            {object.product.source || 'Shop now'}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}
