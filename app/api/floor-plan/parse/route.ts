import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, createRoom, updateProject } from '@/lib/db/queries';

interface DetectedRoom {
  name: string;
  type: string;
  geometry?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
  doors?: string[];
  windows?: string[];
  fixtures?: string[];
  adjacentRooms?: string[];
}

// Mock room detection - in production, this would use AI vision
function mockDetectRooms(): DetectedRoom[] {
  return [
    {
      name: 'Living Room',
      type: 'Living Room',
      geometry: { width: 20, height: 15 },
      doors: ['Entry', 'To Kitchen'],
      windows: ['South Window', 'West Window'],
      fixtures: [],
      adjacentRooms: ['Kitchen', 'Entry'],
    },
    {
      name: 'Kitchen',
      type: 'Kitchen',
      geometry: { width: 12, height: 10 },
      doors: ['To Living Room', 'To Dining'],
      windows: ['East Window'],
      fixtures: ['Island', 'Sink'],
      adjacentRooms: ['Living Room', 'Dining Room'],
    },
    {
      name: 'Primary Bedroom',
      type: 'Bedroom',
      geometry: { width: 14, height: 12 },
      doors: ['Hallway', 'To Ensuite'],
      windows: ['North Window', 'East Window'],
      fixtures: ['Closet'],
      adjacentRooms: ['Primary Bathroom', 'Hallway'],
    },
    {
      name: 'Primary Bathroom',
      type: 'Bathroom',
      geometry: { width: 8, height: 8 },
      doors: ['To Bedroom'],
      windows: ['Skylight'],
      fixtures: ['Shower', 'Tub', 'Double Vanity'],
      adjacentRooms: ['Primary Bedroom'],
    },
    {
      name: 'Dining Room',
      type: 'Dining',
      geometry: { width: 12, height: 10 },
      doors: ['To Kitchen', 'To Living Room'],
      windows: ['South Window'],
      fixtures: [],
      adjacentRooms: ['Kitchen', 'Living Room'],
    },
  ];
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, floorPlanUrl } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const project = getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update project with floor plan URL
    if (floorPlanUrl) {
      updateProject(projectId, { floor_plan_url: floorPlanUrl });
    }

    // Detect rooms (mock for now)
    const detectedRooms = mockDetectRooms();

    // Create rooms in database
    const createdRooms = detectedRooms.map((room) => {
      return createRoom(projectId, room.name, room.type, {
        geometry: JSON.stringify(room.geometry || {}),
        doors: JSON.stringify(room.doors || []),
        windows: JSON.stringify(room.windows || []),
        fixtures: JSON.stringify(room.fixtures || []),
        adjacent_rooms: JSON.stringify(room.adjacentRooms || []),
      });
    });

    return NextResponse.json({
      rooms: createdRooms.filter(Boolean),
      message: `Detected ${createdRooms.length} rooms in the floor plan`,
    });
  } catch (error) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Parsing failed' },
      { status: 500 }
    );
  }
}
