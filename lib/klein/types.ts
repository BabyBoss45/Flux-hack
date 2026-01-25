export type RoomImage = {
  imageUrl: string;
  objects: DetectedObject[];
};

export type DetectedObject = {
  id: string;
  label: string;
  category: 'furniture' | 'surface' | 'lighting' | 'architectural';
  bbox: [number, number, number, number];
};

export type ObjectRecognitionResponse = {
  objects: Array<{
    id: string;
    label: string;
    category: 'furniture' | 'surface' | 'lighting' | 'architectural';
    bbox: [number, number, number, number];
  }>;
};

export type RoomContext = {
  name: string;
  type: string;
  geometry?: {
    length_ft?: number;
    width_ft?: number;
    area_sqft?: number;
  };
  doors?: Array<{ position?: string; width?: number }>;
  windows?: Array<{ position?: string; size?: string }>;
  fixtures?: string[];
  adjacentRooms?: string[];
};

export type ParsedInstruction = {
  intent: 'generate_room' | 'edit_objects' | 'regenerate_room';
  roomId?: string;
  roomContext?: RoomContext;
  userPrompt?: string;
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
  taskType: 'imageGeneration' | 'imageInpainting' | 'imageToImage';
  model: 'flux-2.0-klein';
  prompt: string;
  image?: string;
  mask?: string;
  strength?: number;
  imageSize: '1024x1024';
};

export type RunwareGeneratePayload = {
  input: KleinTask[];
};

