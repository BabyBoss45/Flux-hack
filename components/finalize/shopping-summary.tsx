'use client';

import { Download, ExternalLink, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FurnitureObject, RoomAnalysis } from './room-shopping-card';

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
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
            Shopping Summary
          </p>
          <p className="text-sm text-white/80">
            {analyzedRooms} of {totalRooms} rooms analyzed
          </p>
        </div>
      </div>

      <div className="panel-body space-y-4">
        {/* Total cost */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-accent-warm/20 to-accent-warm/5 border border-accent-warm/30">
          <p className="text-xs font-semibold tracking-wide uppercase text-white/60 mb-1">
            Estimated Total Cost
          </p>
          <p className="text-3xl font-bold text-accent-warm">
            {priceCount > 0 ? `$${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}
          </p>
          <p className="text-xs text-white/50 mt-1">
            Based on {priceCount} items with available pricing
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <p className="text-2xl font-bold text-white">{allProducts.length}</p>
            <p className="text-xs text-white/50">Items Found</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <p className="text-2xl font-bold text-white">{analyzedRooms}</p>
            <p className="text-xs text-white/50">Rooms Analyzed</p>
          </div>
          <div className="p-3 rounded-lg bg-white/5 text-center">
            <p className="text-2xl font-bold text-white">{priceCount}</p>
            <p className="text-xs text-white/50">Priced Items</p>
          </div>
        </div>

        {/* Quick product list */}
        {allProducts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide uppercase text-white/60">
              All Furniture Items
            </p>
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {allProducts.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded bg-white/5 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: item.primary_color }}
                    />
                    <span className="text-white truncate">{item.name}</span>
                    <span className="text-white/40 text-xs">({item.roomName})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.product?.price && (
                      <span className="text-green-400 text-xs">{item.product.price}</span>
                    )}
                    {item.product?.link && (
                      <a
                        href={item.product.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-warm hover:text-accent-warm/80"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={onExport}
            variant="outline"
            className="flex-1 border-white/20 text-white hover:bg-white/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export List
          </Button>
          <Button
            onClick={onShare}
            className="flex-1 bg-accent-warm hover:bg-accent-warm/90"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Design
          </Button>
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
