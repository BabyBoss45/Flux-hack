/**
 * PDF Generator for Furniture Shopping List
 * Creates a fancy PDF with images, descriptions, colors, and prices
 */

import jsPDF from 'jspdf';
import type { FurnitureObject, RoomAnalysis } from '@/components/finalize/room-shopping-card';

interface RoomData {
  roomId: number;
  roomName: string;
  imageUrl?: string;
  analysis: RoomAnalysis;
}

export async function generateShoppingListPDF(rooms: RoomData[], projectName: string = 'My Design Project') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  let currentPage = 1;

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      currentPage++;
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add page number
  const addPageNumber = () => {
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${currentPage}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  };

  // Title Page
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('Furniture Shopping List', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(projectName, pageWidth / 2, 45, { align: 'center' });
  
  yPosition = 80;

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

  // Summary Box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPosition, contentWidth, 40, 3, 3, 'F');
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Summary', margin + 5, yPosition + 8);
  
  doc.setFontSize(12);
  doc.text(`Total Items: ${totalItems}`, margin + 5, yPosition + 18);
  doc.text(`Items with Pricing: ${totalPricedItems}`, margin + 5, yPosition + 26);
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(218, 165, 32); // Gold color
  doc.text(
    `Estimated Total: $${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    margin + 5,
    yPosition + 36
  );
  
  yPosition += 50;

  // Process each room
  const analyzedRooms = rooms.filter((r) => r.analysis.status === 'success');
  
  for (let roomIndex = 0; roomIndex < analyzedRooms.length; roomIndex++) {
    const room = analyzedRooms[roomIndex];
    
    if (!room.analysis.objects || room.analysis.objects.length === 0) continue;

    checkNewPage(80);

    // Room Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition, contentWidth, 15, 'F');
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(room.roomName, margin + 5, yPosition + 10);
    
    // Room style
    if (room.analysis.overall_style) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(room.analysis.overall_style, pageWidth - margin - 5, yPosition + 10, { align: 'right' });
    }
    
    yPosition += 20;

    // Add room image if available
    if (room.imageUrl) {
      try {
        // Load image and add to PDF
        const imgData = await loadImageAsDataURL(room.imageUrl);
        const imgWidth = contentWidth;
        const imgHeight = (imgWidth * 9) / 16; // 16:9 aspect ratio
        
        doc.addImage(imgData, 'JPEG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 5;
      } catch (error) {
        console.error('Failed to load room image:', error);
        // Continue without image
      }
    }

    // Calculate room total
    let roomTotal = 0;
    room.analysis.objects.forEach((obj) => {
      if (obj.product?.price) {
        const priceMatch = obj.product.price.match(/\$?([\d,]+\.?\d*)/);
        if (priceMatch) {
          const priceValue = parseFloat(priceMatch[1].replace(',', ''));
          if (!isNaN(priceValue)) {
            roomTotal += priceValue;
          }
        }
      }
    });

    // Room total
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(218, 165, 32);
    doc.text(
      `Room Total: $${roomTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      margin + 5,
      yPosition
    );
    yPosition += 8;

    // Items
    for (let i = 0; i < room.analysis.objects.length; i++) {
      const item = room.analysis.objects[i];
      
      checkNewPage(45);

      // Item card background
      doc.setFillColor(252, 252, 252);
      doc.roundedRect(margin, yPosition, contentWidth, 40, 2, 2, 'F');
      
      // Color swatch
      const hexColor = item.primary_color || '#CCCCCC';
      const rgb = hexToRgb(hexColor);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.roundedRect(margin + 3, yPosition + 3, 15, 15, 2, 2, 'F');
      
      // Item name
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(item.name, margin + 22, yPosition + 10);
      
      // Category
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(item.category || 'furniture', margin + 22, yPosition + 16);
      
      // Description
      if (item.description) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const descLines = doc.splitTextToSize(item.description, contentWidth - 30);
        doc.text(descLines.slice(0, 2), margin + 22, yPosition + 21);
      }
      
      // Color hex
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Color: ${hexColor}`, margin + 22, yPosition + 30);
      
      // Style tags
      if (item.style_tags && item.style_tags.length > 0) {
        const tags = item.style_tags.slice(0, 3).join(', ');
        doc.text(`Style: ${tags}`, margin + 22, yPosition + 35);
      }
      
      // Price (right side)
      if (item.product?.price) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94); // Green
        doc.text(item.product.price, pageWidth - margin - 5, yPosition + 12, { align: 'right' });
        
        // Source
        if (item.product.source) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(`via ${item.product.source}`, pageWidth - margin - 5, yPosition + 18, { align: 'right' });
        }
      } else {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(150, 150, 150);
        doc.text('Price not available', pageWidth - margin - 5, yPosition + 12, { align: 'right' });
      }
      
      yPosition += 45;
    }
    
    yPosition += 5;
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    currentPage = i;
    addPageNumber();
  }

  // Save the PDF
  const fileName = `${projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_shopping_list.pdf`;
  doc.save(fileName);
}

// Helper function to load image as data URL
async function loadImageAsDataURL(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataURL);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 200, g: 200, b: 200 };
}
