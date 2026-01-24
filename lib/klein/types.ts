export type RoomImage = {
  imageUrl: string;
  objects: DetectedObject[];
};

export type DetectedObject = {
  id: string;
  label: string;
  category: 'furniture' | 'surface' | 'lighting' | 'architectural';
  bbox: [number, number, number, number];
  // Enhanced fields from LLM furniture analysis (optional)
  primary_color?: string; // Hex color code (e.g., "#8B4513")
  style_tags?: string[]; // e.g., ["modern", "minimalist", "rustic"]
  material_tags?: string[]; // e.g., ["wood", "fabric", "leather"]
  description?: string; // Visual description for shopping
  // Product search results (optional)
  product_recommendations?: ProductRecommendation[];
};

export type ProductRecommendation = {
  search_query: string;
  store: string; // e.g., "IKEA", "Wayfair", "Amazon"
  price_range: string; // e.g., "$500-$900"
  url: string; // Direct search/purchase link
};

export type ObjectRecognitionResponse = {
  objects: Array<{
    id: string;
    label: string;
    category: 'furniture' | 'surface' | 'lighting' | 'architectural';
    bbox: [number, number, number, number];
  }>;
};

export type ParsedInstruction = {
  intent: 'generate_room' | 'edit_objects';
  roomId?: string;
  edits?: {
    target: string;
    action: 'modify' | 'replace';
    attributes: Record<string, string | null>;
  }[];
  constraints: {
    preserve_layout: boolean;
    preserve_lighting: boolean;
    preserve_camera: boolean;
  };
};

export type KleinTask = {
  taskType: 'imageGeneration' | 'imageInpainting';
  model: 'flux-2.0-klein';
  prompt: string;
  image?: string;
  mask?: string;
  imageSize: '1024x1024';
};

export type RunwareGeneratePayload = {
  input: KleinTask[];
};

