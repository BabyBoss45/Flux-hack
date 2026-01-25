'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { RoomShoppingCard, type RoomAnalysis } from '@/components/finalize/room-shopping-card';
import { ShoppingSummary, exportShoppingList } from '@/components/finalize/shopping-summary';
import { MOCK_ROOMS_DATA, getMockProjectData } from '@/lib/mock-finalize-data';

interface RoomWithAnalysis {
  roomId: number;
  roomName: string;
  imageUrl: string;
  analysis: RoomAnalysis;
}

export default function DemoFinalizePage() {
  const mockProject = getMockProjectData();
  
  // Initialize with mock data already loaded
  const [roomsWithAnalysis, setRoomsWithAnalysis] = useState<RoomWithAnalysis[]>(
    MOCK_ROOMS_DATA.map((mockRoom) => ({
      roomId: mockRoom.roomId,
      roomName: mockRoom.roomName,
      imageUrl: mockRoom.imageUrl,
      analysis: mockRoom.analysis,
    }))
  );

  // Reset to show loading state for demo
  const resetToIdle = () => {
    setRoomsWithAnalysis(
      MOCK_ROOMS_DATA.map((mockRoom) => ({
        roomId: mockRoom.roomId,
        roomName: mockRoom.roomName,
        imageUrl: mockRoom.imageUrl,
        analysis: { status: 'idle' as const },
      }))
    );
  };

  // Simulate loading for a room
  const simulateAnalysis = async (roomIndex: number) => {
    // Set loading
    setRoomsWithAnalysis((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        analysis: { status: 'loading' },
      };
      return updated;
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Set success with mock data
    const mockData = MOCK_ROOMS_DATA[roomIndex];
    setRoomsWithAnalysis((prev) => {
      const updated = [...prev];
      updated[roomIndex] = {
        ...updated[roomIndex],
        analysis: mockData.analysis,
      };
      return updated;
    });
  };

  // Export shopping list
  const handleExport = () => {
    const data = roomsWithAnalysis.map((r) => ({
      roomId: r.roomId,
      roomName: r.roomName,
      analysis: r.analysis,
    }));

    const text = exportShoppingList(data);

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mock-project-shopping-list.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const analyzedRooms = roomsWithAnalysis.filter((r) => r.analysis.status === 'success').length;

  return (
    <div className="page-shell">
      <Header showSteps currentStep={3} />

      <main className="page-main">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link
                href="/"
                className="inline-flex items-center text-sm text-white/60 hover:text-white mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to home
              </Link>
              <h1 className="text-2xl font-bold text-white">{mockProject.project.name}</h1>
              <p className="text-white/60">
                Demo: Finalize page with pre-generated mock data
              </p>
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-accent-warm/20 border border-accent-warm/30 text-xs text-accent-warm">
                Using mock data - no API calls
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={resetToIdle}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset Demo
              </Button>
            </div>
          </div>

          {/* Main content */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Room cards - 3 columns */}
            <div className="lg:col-span-3">
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {roomsWithAnalysis.map((roomData, index) => (
                  <RoomShoppingCard
                    key={roomData.roomId}
                    roomId={roomData.roomId}
                    roomName={roomData.roomName}
                    imageUrl={roomData.imageUrl}
                    analysis={roomData.analysis}
                    onAnalyze={() => simulateAnalysis(index)}
                  />
                ))}
              </div>
            </div>

            {/* Summary sidebar - 1 column */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <ShoppingSummary
                  rooms={roomsWithAnalysis.map((r) => ({
                    roomId: r.roomId,
                    roomName: r.roomName,
                    analysis: r.analysis,
                  }))}
                  onShare={() => alert('Share dialog would open here')}
                  onExport={handleExport}
                />

                {/* Demo info */}
                <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs font-semibold text-blue-400 mb-2">Demo Info</p>
                  <ul className="text-xs text-white/60 space-y-1">
                    <li>• {analyzedRooms}/3 rooms analyzed</li>
                    <li>• Click "Analyze & Shop" on idle rooms</li>
                    <li>• Click "Reset Demo" to start over</li>
                    <li>• Click product links to visit stores</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
