/**
 * Mock room data for testing the Finalize page.
 * Uses local test images from public/uploads folder.
 * Analysis is fetched from the real /analyze-and-shop API.
 */

export interface MockRoom {
  roomId: number;
  roomName: string;
  imageUrl: string;
}

export const MOCK_ROOMS: MockRoom[] = [
  {
    roomId: 1,
    roomName: 'Living Room',
    imageUrl: '/uploads/mock-living-room.jpg',
  },
  {
    roomId: 2,
    roomName: 'Master Bedroom',
    imageUrl: '/uploads/mock-bedroom.jpg',
  },
  {
    roomId: 3,
    roomName: 'Kitchen',
    imageUrl: '/uploads/mock-kitchen.jpg',
  },
];

export function getMockProjectData() {
  return {
    project: {
      id: 999,
      name: 'Demo Project - Furniture Analysis',
      floor_plan_url: null,
      global_preferences: JSON.stringify({
        style: 'modern',
        budget: 'mid-range',
      }),
    },
    rooms: MOCK_ROOMS.map((r) => ({
      id: r.roomId,
      name: r.roomName,
      type: r.roomName.toLowerCase().replace(' ', '_'),
      approved: 1,
    })),
  };
}
