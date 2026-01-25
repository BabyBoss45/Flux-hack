'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';
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
    <div className="group relative bg-[#111] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 flex flex-col h-full">
      {/* Room Image */}
      <div className="relative aspect-[16/10] bg-black/40 flex-shrink-0 overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={roomName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <ShoppingCart className="w-8 h-8" />
          </div>
        )}
        
        {/* Room name overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <h3 className="text-xl font-semibold text-white tracking-tight">{roomName}</h3>
          {analysis.overall_style && (
            <p className="text-sm text-white/60 mt-1">{analysis.overall_style}</p>
          )}
        </div>
        
        {/* Status badge */}
        {hasData && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/20 backdrop-blur-sm border border-green-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-green-400">Complete</span>
          </div>
        )}
        {isLoading && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-warm/20 backdrop-blur-sm border border-accent-warm/30">
            <Loader2 className="w-3 h-3 animate-spin text-accent-warm" />
            <span className="text-xs font-medium text-accent-warm">Analyzing</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col bg-[#0d0d0d]">
        {/* Idle state - show analyze button */}
        {isIdle && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <p className="text-sm text-white/40 mb-4">Ready to analyze</p>
            <Button
              onClick={onAnalyze}
              className="bg-accent-warm hover:bg-accent-warm/90 text-black font-medium w-full"
              size="lg"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Find Furniture
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <div className="w-full bg-white/[0.03] rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-accent-warm/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-accent-warm" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Analyzing room...</p>
                  <p className="text-xs text-white/40">Finding furniture matches</p>
                </div>
              </div>
              <div className="w-full bg-white/[0.06] rounded-full h-1 overflow-hidden">
                <div className="h-full bg-accent-warm rounded-full animate-pulse" style={{ width: '70%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="flex-1 flex flex-col items-center justify-center py-4 gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm text-white/60 text-center">{analysis.error || 'Analysis failed'}</p>
            <Button
              onClick={onAnalyze}
              variant="outline"
              size="sm"
              className="border-white/10 text-white hover:bg-white/5"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Success state - collapsible furniture list */}
        {hasData && analysis.objects && (
          <CollapsibleFurnitureList objects={analysis.objects} totalPrice={analysis.total_price} />
        )}
      </div>
    </div>
  );
}

// Collapsible furniture list component
function CollapsibleFurnitureList({ objects, totalPrice }: { objects: FurnitureObject[]; totalPrice?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header - clickable to expand/collapse */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 mb-3 border border-white/[0.08] rounded-xl hover:bg-white/[0.03] hover:border-white/[0.12] transition-all"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-accent-warm" />
          ) : (
            <ChevronRight className="w-5 h-5 text-white/50" />
          )}
          <span className="text-base font-medium text-white">
            {objects.length} items found
          </span>
        </div>
        {totalPrice && totalPrice !== 'N/A' && (
          <span className="text-xl font-bold text-accent-warm">
            {totalPrice}
          </span>
        )}
      </button>

      {/* Furniture items - collapsible */}
      {isOpen && (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1 min-h-0">
          {objects.map((obj, index) => (
            <FurnitureItem key={index} object={obj} />
          ))}
        </div>
      )}
    </div>
  );
}

function FurnitureItem({ object }: { object: FurnitureObject }) {
  const hasProduct = object.product && object.product.link;

  return (
    <div className="group/item flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm"
          style={{ backgroundColor: object.primary_color }}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{object.name}</p>
          {object.product?.price && (
            <p className="text-xs font-semibold text-green-400">{object.product.price}</p>
          )}
        </div>
      </div>
      
      {/* Shop button */}
      {hasProduct && object.product ? (
        <a
          href={object.product.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-accent-warm/20 text-white/40 hover:text-accent-warm transition-all"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <div className="w-8 h-8 flex items-center justify-center text-white/20">
          <ShoppingCart className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
