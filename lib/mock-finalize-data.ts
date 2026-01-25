/**
 * Mock data for testing the Finalize page without calling the LLM API.
 * Uses local test images from public/uploads folder.
 */

export interface MockRoomAnalysis {
  roomId: number;
  roomName: string;
  imageUrl: string;
  analysis: {
    status: 'success';
    object_names: string[];
    total_price: string;
    objects: Array<{
      name: string;
      category: string;
      primary_color: string;
      style_tags: string[];
      material_tags: string[];
      description: string;
      product: {
        title: string;
        link: string;
        price: string;
        source: string;
        thumbnail?: string;
      } | null;
    }>;
    overall_style: string;
    color_palette: Array<{ color: string; name: string }>;
  };
}

export const MOCK_ROOMS_DATA: MockRoomAnalysis[] = [
  {
    roomId: 1,
    roomName: 'Living Room',
    imageUrl: '/uploads/mock-living-room.jpg',
    analysis: {
      status: 'success',
      object_names: ['Sectional Sofa', 'Coffee Table', 'Floor Lamp', 'Area Rug', 'TV Console'],
      total_price: '$4,250.00',
      objects: [
        {
          name: 'Sectional Sofa',
          category: 'sofa',
          primary_color: '#8B7355',
          style_tags: ['modern', 'minimalist'],
          material_tags: ['fabric', 'wood'],
          description: 'Large L-shaped sectional sofa in warm beige fabric',
          product: {
            title: 'Modern L-Shaped Sectional Sofa',
            link: 'https://www.wayfair.com/keyword.html?keyword=sectional+sofa',
            price: '$1,899.00',
            source: 'Wayfair',
          },
        },
        {
          name: 'Coffee Table',
          category: 'table',
          primary_color: '#5C4033',
          style_tags: ['modern', 'industrial'],
          material_tags: ['wood', 'metal'],
          description: 'Rectangular wood coffee table with metal legs',
          product: {
            title: 'Industrial Wood Coffee Table',
            link: 'https://www.amazon.com/s?k=wood+coffee+table',
            price: '$450.00',
            source: 'Amazon',
          },
        },
        {
          name: 'Floor Lamp',
          category: 'lamp',
          primary_color: '#2F2F2F',
          style_tags: ['modern', 'minimalist'],
          material_tags: ['metal'],
          description: 'Tall arc floor lamp with black metal finish',
          product: {
            title: 'Arc Floor Lamp Black',
            link: 'https://www.ikea.com/us/en/search/?q=floor+lamp',
            price: '$149.00',
            source: 'IKEA',
          },
        },
        {
          name: 'Area Rug',
          category: 'rug',
          primary_color: '#D4C4B0',
          style_tags: ['bohemian', 'traditional'],
          material_tags: ['wool'],
          description: 'Large cream and beige patterned area rug',
          product: {
            title: 'Bohemian Area Rug 8x10',
            link: 'https://www.target.com/s?searchTerm=area+rug',
            price: '$599.00',
            source: 'Target',
          },
        },
        {
          name: 'TV Console',
          category: 'cabinet',
          primary_color: '#3D3D3D',
          style_tags: ['modern', 'minimalist'],
          material_tags: ['wood', 'metal'],
          description: 'Low-profile TV stand with storage',
          product: {
            title: 'Modern TV Stand 65 inch',
            link: 'https://www.wayfair.com/keyword.html?keyword=tv+stand',
            price: '$349.00',
            source: 'Wayfair',
          },
        },
      ],
      overall_style: 'Modern Minimalist',
      color_palette: [
        { color: '#8B7355', name: 'Warm Beige' },
        { color: '#5C4033', name: 'Dark Wood' },
        { color: '#F5F5F5', name: 'Off White' },
      ],
    },
  },
  {
    roomId: 2,
    roomName: 'Master Bedroom',
    imageUrl: '/uploads/mock-bedroom.jpg',
    analysis: {
      status: 'success',
      object_names: ['King Bed', 'Nightstand', 'Dresser', 'Table Lamp', 'Armchair'],
      total_price: '$3,847.00',
      objects: [
        {
          name: 'King Bed',
          category: 'bed',
          primary_color: '#E8DCC4',
          style_tags: ['modern', 'scandinavian'],
          material_tags: ['fabric', 'wood'],
          description: 'Upholstered king platform bed with wooden frame',
          product: {
            title: 'Upholstered King Platform Bed',
            link: 'https://www.westelm.com/search/?q=king+bed',
            price: '$1,599.00',
            source: 'West Elm',
          },
        },
        {
          name: 'Nightstand',
          category: 'table',
          primary_color: '#8B4513',
          style_tags: ['modern', 'mid-century'],
          material_tags: ['wood'],
          description: 'Walnut nightstand with two drawers',
          product: {
            title: 'Mid-Century Nightstand Walnut',
            link: 'https://www.article.com/search?q=nightstand',
            price: '$349.00',
            source: 'Article',
          },
        },
        {
          name: 'Dresser',
          category: 'dresser',
          primary_color: '#8B4513',
          style_tags: ['modern', 'mid-century'],
          material_tags: ['wood'],
          description: 'Six-drawer walnut dresser with brass handles',
          product: {
            title: 'Mid-Century 6-Drawer Dresser',
            link: 'https://www.wayfair.com/keyword.html?keyword=dresser',
            price: '$899.00',
            source: 'Wayfair',
          },
        },
        {
          name: 'Table Lamp',
          category: 'lamp',
          primary_color: '#D4AF37',
          style_tags: ['modern', 'glam'],
          material_tags: ['ceramic', 'fabric'],
          description: 'Ceramic table lamp with gold accents',
          product: {
            title: 'Ceramic Table Lamp Gold',
            link: 'https://www.target.com/s?searchTerm=table+lamp',
            price: '$89.00',
            source: 'Target',
          },
        },
        {
          name: 'Armchair',
          category: 'chair',
          primary_color: '#4A6741',
          style_tags: ['modern', 'scandinavian'],
          material_tags: ['velvet', 'wood'],
          description: 'Green velvet accent chair with wooden legs',
          product: {
            title: 'Velvet Accent Chair Green',
            link: 'https://www.amazon.com/s?k=accent+chair',
            price: '$399.00',
            source: 'Amazon',
          },
        },
      ],
      overall_style: 'Modern Scandinavian',
      color_palette: [
        { color: '#E8DCC4', name: 'Cream' },
        { color: '#8B4513', name: 'Walnut' },
        { color: '#4A6741', name: 'Forest Green' },
      ],
    },
  },
  {
    roomId: 3,
    roomName: 'Kitchen',
    imageUrl: '/uploads/mock-kitchen.jpg',
    analysis: {
      status: 'success',
      object_names: ['Dining Table', 'Dining Chairs', 'Pendant Light', 'Bar Stools'],
      total_price: '$2,196.00',
      objects: [
        {
          name: 'Dining Table',
          category: 'table',
          primary_color: '#DEB887',
          style_tags: ['modern', 'farmhouse'],
          material_tags: ['wood'],
          description: 'Oak dining table with natural finish',
          product: {
            title: 'Farmhouse Oak Dining Table',
            link: 'https://www.wayfair.com/keyword.html?keyword=dining+table',
            price: '$799.00',
            source: 'Wayfair',
          },
        },
        {
          name: 'Dining Chairs',
          category: 'chair',
          primary_color: '#2F2F2F',
          style_tags: ['modern', 'industrial'],
          material_tags: ['metal', 'wood'],
          description: 'Set of 4 black metal dining chairs',
          product: {
            title: 'Industrial Dining Chairs Set of 4',
            link: 'https://www.amazon.com/s?k=dining+chairs',
            price: '$299.00',
            source: 'Amazon',
          },
        },
        {
          name: 'Pendant Light',
          category: 'lamp',
          primary_color: '#2F2F2F',
          style_tags: ['modern', 'industrial'],
          material_tags: ['metal'],
          description: 'Black dome pendant light fixture',
          product: {
            title: 'Industrial Pendant Light Black',
            link: 'https://www.ikea.com/us/en/search/?q=pendant+light',
            price: '$79.00',
            source: 'IKEA',
          },
        },
        {
          name: 'Bar Stools',
          category: 'stool',
          primary_color: '#8B4513',
          style_tags: ['modern', 'industrial'],
          material_tags: ['wood', 'metal'],
          description: 'Set of 2 counter height bar stools',
          product: {
            title: 'Counter Height Bar Stools Set of 2',
            link: 'https://www.target.com/s?searchTerm=bar+stools',
            price: '$249.00',
            source: 'Target',
          },
        },
      ],
      overall_style: 'Modern Industrial',
      color_palette: [
        { color: '#DEB887', name: 'Natural Oak' },
        { color: '#2F2F2F', name: 'Matte Black' },
        { color: '#FFFFFF', name: 'White' },
      ],
    },
  },
];

export function getMockProjectData() {
  return {
    project: {
      id: 999,
      name: 'Mock Test Project',
      floor_plan_url: null,
      global_preferences: JSON.stringify({
        style: 'modern',
        budget: 'mid-range',
      }),
    },
    rooms: MOCK_ROOMS_DATA.map((r) => ({
      id: r.roomId,
      name: r.roomName,
      type: r.roomName.toLowerCase().replace(' ', '_'),
      approved: 1,
    })),
  };
}
