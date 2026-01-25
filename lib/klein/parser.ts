import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ParsedInstruction, DetectedObject, RoomContext } from './types';

const ParsedInstructionSchema = z.object({
  intent: z.enum(['generate_room', 'edit_objects', 'regenerate_room']),
  edits: z
    .array(
      z.object({
        target: z.string(),
        action: z.enum(['modify', 'replace']),
        attributes: z.record(z.string(), z.string().nullable()),
      })
    )
    .optional(),
  constraints: z.object({
    preserve_layout: z.boolean(),
    preserve_lighting: z.boolean(),
    preserve_camera: z.boolean(),
  }),
});

const PARSER_PROMPT = `You are an instruction parser for an interior design editor.

Convert the user's request into STRICT JSON following this schema:
{
  intent: "generate_room" | "edit_objects" | "regenerate_room",
  edits: [
    {
      target: string,
      action: "modify" | "replace",
      attributes: object
    }
  ],
  constraints: {
    preserve_layout: boolean,
    preserve_lighting: boolean,
    preserve_camera: boolean
  }
}

Intent rules:
- "generate_room": First-time generation, no existing image
- "regenerate_room": User wants to change overall style, colors, furniture arrangement, or major aspects. Use when existing image should be modified but not targeting a specific object.
- "edit_objects": User wants to change a SPECIFIC object (sofa, table, lamp, etc.). Must have a target object.

Rules:
- Do not invent objects
- Only include objects the user explicitly mentions
- If user mentions changing style, colors, mood, or overall feel → regenerate_room
- If user mentions specific furniture item to change → edit_objects
- If unsure, leave attribute as null
- Output JSON only, no explanation

Has existing image: {hasExistingImage}
Available objects: {availableObjects}
Room info: {roomInfo}

User text: {userText}`;

export async function parseUserIntent(
  userText: string,
  availableObjects: DetectedObject[],
  roomId: string,
  selectedObjectId?: string | null,
  roomContext?: RoomContext,
  hasExistingImage: boolean = false
): Promise<ParsedInstruction> {
  if (!userText.trim()) {
    throw new Error('User text cannot be empty');
  }

  if (!roomId) {
    throw new Error('Room ID is required');
  }

  const availableObjectsList = availableObjects.map((obj) => obj.label).join(', ');
  
  // Build room info string from context
  let roomInfo = 'Not provided';
  if (roomContext) {
    const parts = [`Type: ${roomContext.type}`];
    if (roomContext.geometry?.area_sqft) {
      parts.push(`Area: ${roomContext.geometry.area_sqft} sq ft`);
    }
    if (roomContext.fixtures && roomContext.fixtures.length > 0) {
      parts.push(`Fixtures: ${roomContext.fixtures.join(', ')}`);
    }
    if (roomContext.windows && roomContext.windows.length > 0) {
      parts.push(`Windows: ${roomContext.windows.length}`);
    }
    roomInfo = parts.join(', ');
  }
  
  // If a specific object is selected, prioritize it in the context
  let contextText = userText;
  if (selectedObjectId && availableObjects.length > 0) {
    const selectedObj = availableObjects.find(obj => obj.id === selectedObjectId);
    if (selectedObj) {
      contextText = `Editing ${selectedObj.label}: ${userText}`;
    }
  }

  const prompt = PARSER_PROMPT
    .replace('{hasExistingImage}', hasExistingImage ? 'Yes' : 'No')
    .replace('{availableObjects}', availableObjectsList || 'none')
    .replace('{roomInfo}', roomInfo)
    .replace('{userText}', contextText);

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      schema: ParsedInstructionSchema,
    });

    const parsed = object as ParsedInstruction;
    parsed.roomId = roomId;
    parsed.userPrompt = userText;
    parsed.roomContext = roomContext;

    // If object is selected, force edit_objects intent
    if (selectedObjectId && availableObjects.length > 0) {
      const selectedObj = availableObjects.find(obj => obj.id === selectedObjectId);
      if (selectedObj) {
        parsed.intent = 'edit_objects';
        // Extract attributes from user text
        parsed.edits = [{
          target: selectedObj.label,
          action: 'modify',
          attributes: {
            description: userText,
            request: userText,
          },
        }];
      }
    }

    if (parsed.intent === 'edit_objects' && parsed.edits) {
      const validEdits = parsed.edits.filter((edit) =>
        availableObjects.some((obj) => obj.label.toLowerCase() === edit.target.toLowerCase())
      );
      parsed.edits = validEdits.length > 0 ? validEdits : undefined;
    }

    // Handle intent fallbacks based on context
    if (parsed.intent === 'edit_objects' && (!parsed.edits || parsed.edits.length === 0)) {
      if (hasExistingImage) {
        // Has image but no specific object → regenerate with changes
        parsed.intent = 'regenerate_room';
      } else if (availableObjects.length === 0) {
        // No image, no objects → generate new
        parsed.intent = 'generate_room';
      } else {
        // If objects exist but edit failed, default to regenerate
        parsed.intent = 'regenerate_room';
      }
    }

    // If regenerate_room but no existing image, fallback to generate_room
    if (parsed.intent === 'regenerate_room' && !hasExistingImage) {
      parsed.intent = 'generate_room';
    }

    return parsed;
  } catch (error) {
    console.error('Parser error:', error);
    return {
      intent: 'edit_objects',
      roomId,
      constraints: {
        preserve_layout: true,
        preserve_lighting: true,
        preserve_camera: true,
      },
    };
  }
}

