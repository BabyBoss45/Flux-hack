/**
 * PDF Generator for Furniture Shopping List
 * Uses browser print API - no external dependencies
 */

import type { RoomAnalysis } from '@/components/finalize/room-shopping-card';

interface RoomData {
  roomId: number;
  roomName: string;
  imageUrl?: string;
  analysis: RoomAnalysis;
}

export async function generateShoppingListPDF(rooms: RoomData[], projectName: string = 'My Design Project') {
  // Calculate totals
  let grandTotal = 0;
  let totalItems = 0;
  let totalPricedItems = 0;

  rooms.forEach((room) => {
    if (room.analysis.status === 'success' && room.analysis.objects) {
      totalItems += room.analysis.objects.length;
      room.analysis.objects.forEach((obj) => {
        if (obj.product?.price) {
          const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
          if (priceMatch) {
            const priceValue = parseFloat(priceMatch[1].replace(',', ''));
            if (!isNaN(priceValue)) {
              grandTotal += priceValue;
              totalPricedItems++;
            }
          }
        }
      });
    }
  });

  const analyzedRooms = rooms.filter((r) => r.analysis.status === 'success');

  // Build HTML content
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${projectName} - Shopping List</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 15mm;
    }
    
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      padding: 20px;
      line-height: 1.4;
    }
    
    .header {
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin-bottom: 24px;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 8px;
    }
    
    .header .project-name {
      font-size: 16px;
      color: rgba(255,255,255,0.6);
    }
    
    .summary {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .summary-stats {
      display: flex;
      gap: 32px;
    }
    
    .stat {
      text-align: center;
    }
    
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
    }
    
    .stat-label {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .grand-total {
      text-align: right;
    }
    
    .grand-total .label {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
    }
    
    .grand-total .amount {
      font-size: 32px;
      font-weight: 700;
      color: #22c55e;
    }
    
    .room {
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    
    .room-header {
      background: rgba(255,255,255,0.05);
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    
    .room-name {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    
    .room-style {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      font-style: italic;
    }
    
    .room-total {
      font-size: 16px;
      font-weight: 600;
      color: #22c55e;
    }
    
    .room-image {
      width: 100%;
      max-height: 300px;
      object-fit: cover;
    }
    
    .items {
      padding: 12px;
    }
    
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    
    .item:last-child {
      margin-bottom: 0;
    }
    
    .color-swatch {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .item-details {
      flex: 1;
      min-width: 0;
    }
    
    .item-name {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 2px;
    }
    
    .item-category {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .item-description {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .item-meta {
      font-size: 10px;
      color: rgba(255,255,255,0.3);
      margin-top: 4px;
    }
    
    .item-price {
      text-align: right;
      flex-shrink: 0;
    }
    
    .price-value {
      font-size: 16px;
      font-weight: 700;
      color: #22c55e;
    }
    
    .price-source {
      font-size: 10px;
      color: rgba(255,255,255,0.4);
    }
    
    .no-price {
      font-size: 12px;
      color: rgba(255,255,255,0.3);
      font-style: italic;
    }
    
    .print-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #22c55e;
      color: #000;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      z-index: 1000;
    }
    
    .print-btn:hover {
      background: #16a34a;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: rgba(255,255,255,0.3);
      font-size: 12px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">📄 Save as PDF</button>
  
  <div class="header">
    <h1>🛋️ Furniture Shopping List</h1>
    <div class="project-name">${escapeHtml(projectName)}</div>
  </div>
  
  <div class="summary">
    <div class="summary-stats">
      <div class="stat">
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Total Items</div>
      </div>
      <div class="stat">
        <div class="stat-value">${totalPricedItems}</div>
        <div class="stat-label">With Pricing</div>
      </div>
      <div class="stat">
        <div class="stat-value">${analyzedRooms.length}</div>
        <div class="stat-label">Rooms</div>
      </div>
    </div>
    <div class="grand-total">
      <div class="label">Estimated Total</div>
      <div class="amount">$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
  </div>
  
  ${analyzedRooms.map((room, idx) => {
    if (!room.analysis.objects || room.analysis.objects.length === 0) return '';
    
    let roomTotal = 0;
    room.analysis.objects.forEach((obj) => {
      if (obj.product?.price) {
        const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          const priceValue = parseFloat(priceMatch[1].replace(',', ''));
          if (!isNaN(priceValue)) roomTotal += priceValue;
        }
      }
    });
    
    return `
      <div class="room ${idx > 0 ? 'page-break' : ''}">
        <div class="room-header">
          <div>
            <div class="room-name">${escapeHtml(room.roomName)}</div>
            ${room.analysis.overall_style ? `<div class="room-style">${escapeHtml(room.analysis.overall_style)}</div>` : ''}
          </div>
          <div class="room-total">$${roomTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        ${room.imageUrl ? `<img class="room-image" src="${room.imageUrl}" alt="${escapeHtml(room.roomName)}" crossorigin="anonymous" />` : ''}
        <div class="items">
          ${room.analysis.objects.map((item) => `
            <div class="item">
              <div class="color-swatch" style="background-color: ${item.primary_color || '#666'}"></div>
              <div class="item-details">
                <div class="item-name">${escapeHtml(item.name)}</div>
                <div class="item-category">${escapeHtml(item.category || 'furniture')}</div>
                ${item.description ? `<div class="item-description">${escapeHtml(item.description)}</div>` : ''}
                <div class="item-meta">
                  Color: ${item.primary_color || 'N/A'}
                  ${item.style_tags && item.style_tags.length > 0 ? ` • Style: ${item.style_tags.slice(0, 3).join(', ')}` : ''}
                </div>
              </div>
              <div class="item-price">
                ${item.product?.price 
                  ? `<div class="price-value">${item.product.price}</div>
                     ${item.product.source ? `<div class="price-source">via ${escapeHtml(item.product.source)}</div>` : ''}`
                  : '<div class="no-price">Price not available</div>'
                }
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('')}
  
  <div class="footer">
    Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</body>
</html>
  `;

  // Open in new window for printing
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Wait for images to load then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
      }, 500);
    };
  } else {
    // Fallback: download as HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_shopping_list.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
