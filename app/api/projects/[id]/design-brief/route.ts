import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { getProjectById, updateProject, getRoomsByProjectId, updateRoom } from '@/lib/db/queries';

export interface DesignBriefData {
  // New field names
  buildingType?: string;
  architectureStyle?: string;
  atmosphere?: string;
  constraints?: string[];
  customNotes?: string;
  // Legacy field names (for backwards compatibility)
  globalStyle?: string;
  styleRefinement?: string;
  colorMood?: string;
  nonNegotiables?: string[];
  rooms?: {
    name: string;
    function?: string;
    furniture?: string[];
    vibe?: string;
    customNotes?: string;
  }[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);
    const project = getProjectById(projectId);

    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body: DesignBriefData = await request.json();

    // Build global preferences JSON (support both old and new field names)
    const globalPreferences = {
      // New field names
      buildingType: body.buildingType,
      architectureStyle: body.architectureStyle,
      atmosphere: body.atmosphere,
      constraints: body.constraints || body.nonNegotiables || [],
      customNotes: body.customNotes,
      // Legacy field names
      style: body.globalStyle || body.architectureStyle,
      styleRefinement: body.styleRefinement,
      colorMood: body.colorMood || body.atmosphere,
      nonNegotiables: body.nonNegotiables || body.constraints || [],
      wizardCompleted: true,
      completedAt: new Date().toISOString(),
    };

    // Update project with global preferences
    updateProject(projectId, {
      global_preferences: JSON.stringify(globalPreferences),
    });

    // Update room-specific preferences (only if rooms data provided)
    if (body.rooms && body.rooms.length > 0) {
      const rooms = getRoomsByProjectId(projectId);
      for (const roomData of body.rooms) {
        const room = rooms.find((r) => 
          r.name.toLowerCase() === roomData.name.toLowerCase() ||
          r.name.toLowerCase().includes(roomData.name.toLowerCase())
        );
        
        if (room) {
          // Store room preferences in geometry field as JSON (reusing existing field)
          const roomPrefs = {
            function: roomData.function,
            furniture: roomData.furniture,
            vibe: roomData.vibe,
            customNotes: roomData.customNotes,
          };
          
          const existingGeometry = room.geometry ? JSON.parse(room.geometry) : {};
          const updatedGeometry = {
            ...existingGeometry,
            preferences: roomPrefs,
          };
          
          updateRoom(room.id, {
            geometry: JSON.stringify(updatedGeometry),
          });
        }
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Design brief saved successfully',
    });
  } catch (error) {
    console.error('Failed to save design brief:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save design brief' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const projectId = parseInt(id, 10);
    const project = getProjectById(projectId);

    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const globalPrefs = project.global_preferences 
      ? JSON.parse(project.global_preferences)
      : {};

    // Get room preferences
    const rooms = getRoomsByProjectId(projectId);
    const roomPreferences = rooms.map((room) => {
      const geometry = room.geometry ? JSON.parse(room.geometry) : {};
      return {
        roomId: room.id,
        roomName: room.name,
        roomType: room.type,
        ...geometry.preferences,
      };
    });

    return NextResponse.json({
      globalPreferences: globalPrefs,
      roomPreferences,
      wizardCompleted: globalPrefs.wizardCompleted || false,
    });
  } catch (error) {
    console.error('Failed to get design brief:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get design brief' },
      { status: 500 }
    );
  }
}

