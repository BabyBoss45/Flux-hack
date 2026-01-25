export type RoomImage = {
  imageUrl: string;
  objects: DetectedObject[];
};

export type DetectedObject = {
  id: string;
  label?: string;  // Primary field
  name?: string;   // Fallback for backwards compatibility (database stores 'name')
  category: 'furniture' | 'surface' | 'lighting' | 'architectural';
  bbox?: [number, number, number, number];  // Optional - may be missing for legacy data
};

export type ObjectRecognitionResponse = {
  objects: Array<{
    id: string;
    label?: string;
    name?: string;
    category: 'furniture' | 'surface' | 'lighting' | 'architectural';
    bbox?: [number, number, number, number];
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

