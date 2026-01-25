'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, Share2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FurnitureObject, RoomAnalysis } from './room-shopping-card';
import { generateShoppingListPDF } from '@/lib/pdf-generator';

interface RoomData {
  roomId: number;
  roomName: string;
  analysis: RoomAnalysis;
}

interface ShoppingSummaryProps {
  rooms: RoomData[];
  onShare: () => void;
  onExport: () => void;
}

// Collapsible room section component
function CollapsibleRoomSection({ room }: { room: RoomData }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (room.analysis.status !== 'success' || !room.analysis.objects) {
    return null;
  }

  const objects = room.analysis.objects;
  
  // Calculate room total
  let roomTotal = 0;
  let roomPriceCount = 0;
  objects.forEach((obj) => {
    if (obj.product?.price) {
      const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
      if (priceMatch) {
        const priceValue = parseFloat(priceMatch[1].replace(',', ''));
        if (!isNaN(priceValue)) {
          roomTotal += priceValue;
          roomPriceCount++;
        }
      }
    }
  });

  return (
    <div className="border-b border-white/[0.04] last:border-b-0">
      {/* Room header - clickable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/40" />
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-white">{room.roomName}</p>
            <p className="text-xs text-white/40">{objects.length} items</p>
          </div>
        </div>
        <span className="text-sm font-semibold text-accent-warm">
          ${roomTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </button>
      
      {/* Collapsible items */}
      {isOpen && (
        <div className="pb-2">
          {objects.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-2 ml-7 hover:bg-white/[0.02] transition-colors"
            >
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0"
                style={{ backgroundColor: item.primary_color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{item.name}</p>
                {item.product?.source && (
                  <p className="text-xs text-white/30">via {item.product.source}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {item.product?.price ? (
                  <p className="text-sm font-medium text-green-400">{item.product.price}</p>
                ) : (
                  <p className="text-xs text-white/20">No price</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Collapsible room list
function CollapsibleRoomList({ rooms }: { rooms: RoomData[] }) {
  const analyzedRooms = rooms.filter((r) => r.analysis.status === 'success');
  
  if (analyzedRooms.length === 0) {
    return null;
  }

  return (
    <div>
      {analyzedRooms.map((room) => (
        <CollapsibleRoomSection key={room.roomId} room={room} />
      ))}
    </div>
  );
}

export function ShoppingSummary({ rooms, onShare, onExport }: ShoppingSummaryProps) {
  // Aggregate all products across rooms
  const allProducts: Array<FurnitureObject & { roomName: string }> = [];
  let totalPrice = 0;
  let priceCount = 0;

  rooms.forEach((room) => {
    if (room.analysis.status === 'success' && room.analysis.objects) {
      room.analysis.objects.forEach((obj) => {
        allProducts.push({ ...obj, roomName: room.roomName });
        
        // Calculate total price
        if (obj.product?.price) {
          const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) {
            const priceValue = parseFloat(priceMatch[1].replace(',', ''));
            if (!isNaN(priceValue)) {
              totalPrice += priceValue;
              priceCount++;
            }
          }
        }
      });
    }
  });

  const analyzedRooms = rooms.filter((r) => r.analysis.status === 'success').length;
  const totalRooms = rooms.length;

  return (
    <div className="bg-[#0d0d0d] rounded-2xl border border-white/[0.08] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Your Cart</h2>
            <p className="text-sm text-white/40 mt-1">
              {allProducts.length} items from {analyzedRooms} rooms
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-green-400">{analyzedRooms}/{totalRooms} Complete</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Product list - collapsible by room */}
        {allProducts.length > 0 ? (
          <div className="flex-1 overflow-y-auto">
            <CollapsibleRoomList rooms={rooms} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center mb-4">
              <ShoppingCart className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-base text-white/40">Your cart is empty</p>
            <p className="text-sm text-white/20 mt-1">Analyze rooms to find furniture</p>
          </div>
        )}

        {/* Checkout footer */}
        <div className="p-6 border-t border-white/[0.06] flex-shrink-0 bg-[#0a0a0a]">
          {/* Order summary */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Subtotal ({allProducts.length} items)</span>
              <span className="text-white">
                {priceCount > 0 ? `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/50">Items with pricing</span>
              <span className="text-white">{priceCount} of {allProducts.length}</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-white">Estimated Total</span>
              <span className="text-2xl font-bold text-accent-warm">
                {priceCount > 0 ? `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button
              onClick={onShare}
              className="w-full h-12 bg-accent-warm hover:bg-accent-warm/90 text-black font-semibold text-base"
              disabled={allProducts.length === 0}
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share Shopping List
            </Button>
            <Button
              onClick={onExport}
              variant="outline"
              className="w-full h-11 border-white/[0.1] text-white/70 hover:text-white hover:bg-white/[0.04]"
              disabled={allProducts.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download as PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function exportShoppingList(rooms: RoomData[]): string {
  const lines: string[] = ['FURNITURE SHOPPING LIST', '='.repeat(50), ''];

  let grandTotal = 0;

  rooms.forEach((room) => {
    if (room.analysis.status === 'success' && room.analysis.objects) {
      lines.push(`## ${room.roomName}`);
      if (room.analysis.overall_style) {
        lines.push(`Style: ${room.analysis.overall_style}`);
      }
      lines.push('');

      room.analysis.objects.forEach((obj) => {
        lines.push(`- ${obj.name} (${obj.category})`);
        if (obj.description) {
          lines.push(`  Description: ${obj.description}`);
        }
        if (obj.product) {
          lines.push(`  Price: ${obj.product.price || 'N/A'}`);
          lines.push(`  Source: ${obj.product.source || 'N/A'}`);
          if (obj.product.link) {
            lines.push(`  Link: ${obj.product.link}`);
          }
          
          // Add to total
          if (obj.product.price) {
            const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
            if (priceMatch) {
              const priceValue = parseFloat(priceMatch[1].replace(',', ''));
              if (!isNaN(priceValue)) {
                grandTotal += priceValue;
              }
            }
          }
        }
        lines.push('');
      });

      if (room.analysis.total_price) {
        lines.push(`Room Total: ${room.analysis.total_price}`);
      }
      lines.push('');
      lines.push('-'.repeat(50));
      lines.push('');
    }
  });

  lines.push('');
  lines.push('='.repeat(50));
  lines.push(`GRAND TOTAL: $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  return lines.join('\n');
}
