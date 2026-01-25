'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomShoppingCard, type RoomAnalysis } from '@/components/finalize/room-shopping-card';
import { ShoppingSummary, exportShoppingList } from '@/components/finalize/shopping-summary';
import { MOCK_ROOMS, getMockProjectData } from '@/lib/mock-finalize-data';

interface RoomWithAnalysis {
  roomId: number;
  roomName: string;
  imageUrl: string;
  analysis: RoomAnalysis;
}

export default function DemoFinalizePage() {
  const mockProject = getMockProjectData();
  
  // Initialize with idle state - will call real API
  const [roomsWithAnalysis, setRoomsWithAnalysis] = useState<RoomWithAnalysis[]>(
    MOCK_ROOMS.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      imageUrl: room.imageUrl,
      analysis: { status: 'idle' as const },
    }))
  );

  // Reset all rooms to idle state
  const resetToIdle = () => {
    setRoomsWithAnalysis(
      MOCK_ROOMS.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        imageUrl: room.imageUrl,
        analysis: { status: 'idle' as const },
      }))
    );
  };

  // Call the real /analyze-and-shop API
  const analyzeRoom = async (roomIndex: number) => {
    const room = roomsWithAnalysis[roomIndex];
    
    // Set loading state
    setRoomsWithAnalysis((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        analysis: { status: 'loading' },
      };
      return updated;
    });

    try {
      // Fetch the image and convert to blob
      const imageResponse = await fetch(room.imageUrl);
      const imageBlob = await imageResponse.blob();
      
      // Create FormData with the image
      const formData = new FormData();
      formData.append('image', imageBlob, `${room.roomName.toLowerCase().replace(' ', '-')}.jpg`);
      
      // Call the analyze-and-shop API
      const res = await fetch('/api/llm/analyze-and-shop', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.status === 'success') {
        setRoomsWithAnalysis((prev) => {
          const updated = [...prev];
          updated[roomIndex] = {
            ...updated[roomIndex],
            analysis: {
              status: 'success',
              object_names: data.object_names || [],
              total_price: data.total_price || 'N/A',
              objects: data.objects || [],
              overall_style: data.overall_style || 'Unknown',
              color_palette: data.color_palette || [],
            },
          };
          return updated;
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setRoomsWithAnalysis((prev) => {
        const updated = [...prev];
        updated[roomIndex] = {
          ...updated[roomIndex],
          analysis: {
            status: 'error',
            error: error instanceof Error ? error.message : 'Analysis failed',
          },
        };
        return updated;
      });
    }
  };

  // Export shopping list as PDF
  const handleExport = async () => {
    const data = roomsWithAnalysis.map((r) => ({
      roomId: r.roomId,
      roomName: r.roomName,
      imageUrl: r.imageUrl,
      analysis: r.analysis,
    }));

    try {
      const { generateShoppingListPDF } = await import('@/lib/pdf-generator');
      await generateShoppingListPDF(data, mockProject.project.name);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const analyzedRooms = roomsWithAnalysis.filter((r) => r.analysis.status === 'success').length;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header showSteps currentStep={3} />

      <main className="min-h-[calc(100vh-64px)]">
        <div className="w-full px-6 lg:px-12 py-8">
          {/* Compact Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-6">
              <Link
                href="/"
                className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-white tracking-tight">Shop Your Design</h1>
                <p className="text-sm text-white/50">Find matching furniture for your rooms</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  roomsWithAnalysis.forEach((_, index) => {
                    if (roomsWithAnalysis[index].analysis.status === 'idle') {
                      setTimeout(() => analyzeRoom(index), index * 500);
                    }
                  });
                }}
                className="bg-accent-warm hover:bg-accent-warm/90 text-black font-medium px-5"
                disabled={roomsWithAnalysis.every(r => r.analysis.status !== 'idle')}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Analyze All
              </Button>
              <Button
                onClick={resetToIdle}
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/5"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Main content */}
          <div className="grid lg:grid-cols-[1fr_480px] gap-8">
            {/* Room cards - main area */}
            <div className="flex flex-col min-h-[calc(100vh-280px)]">
              <div className="grid md:grid-cols-2 gap-5 content-start">
                {roomsWithAnalysis.map((roomData, index) => (
                  <RoomShoppingCard
                    key={roomData.roomId}
                    roomId={roomData.roomId}
                    roomName={roomData.roomName}
                    imageUrl={roomData.imageUrl}
                    analysis={roomData.analysis}
                    onAnalyze={() => analyzeRoom(index)}
                  />
                ))}
              </div>
            </div>

            {/* Summary sidebar - 1 column */}
            <div className="lg:col-span-1 flex flex-col">
              <div className="sticky top-6 flex-1">
                <ShoppingSummary
                  rooms={roomsWithAnalysis.map((r) => ({
                    roomId: r.roomId,
                    roomName: r.roomName,
                    analysis: r.analysis,
                  }))}
                  onShare={() => alert('Share dialog would open here')}
                  onExport={handleExport}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
