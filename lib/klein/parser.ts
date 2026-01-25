import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { ParsedInstruction, DetectedObject } from './types';

const ParsedInstructionSchema = z.object({
  intent: z.enum(['generate_room', 'edit_objects']),
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
  intent: "generate_room" | "edit_objects",
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

Rules:
- Do not invent objects
- Only include objects the user explicitly mentions
- If unsure, leave attribute as null
- Output JSON only, no explanation

Available objects: {availableObjects}

User text: {userText}`;

export async function parseUserIntent(
  userText: string,
  availableObjects: DetectedObject[],
  roomId: string,
  selectedObjectId?: string | null
): Promise<ParsedInstruction> {
  if (!userText.trim()) {
    throw new Error('User text cannot be empty');
  }

  if (!roomId) {
    throw new Error('Room ID is required');
  }

  const availableObjectsList = availableObjects.map((obj) => obj.label || obj.name || 'unknown').join(', ');
  
  // If a specific object is selected, prioritize it in the context
  let contextText = userText;
  if (selectedObjectId && availableObjects.length > 0) {
    const selectedObj = availableObjects.find(obj => obj.id === selectedObjectId);
    if (selectedObj) {
      const objLabel = selectedObj.label || selectedObj.name || 'object';
      contextText = `Editing ${objLabel}: ${userText}`;
    }
  }

  const prompt = PARSER_PROMPT
    .replace('{availableObjects}', availableObjectsList || 'none')
    .replace('{userText}', contextText);

  try {
    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt,
      schema: ParsedInstructionSchema,
    });

    const parsed = object as ParsedInstruction;
    parsed.roomId = roomId;

    // If object is selected, force edit_objects intent
    if (selectedObjectId && availableObjects.length > 0) {
      const selectedObj = availableObjects.find(obj => obj.id === selectedObjectId);
      if (selectedObj) {
        const objLabel = selectedObj.label || selectedObj.name || 'object';
        parsed.intent = 'edit_objects';
        // Extract attributes from user text
        parsed.edits = [{
          target: objLabel,
          action: 'modify',
          attributes: {
            description: userText,
            request: userText,
          },
        }];
      }
    }

    // Validate edits: filter out invalid ones with defensive null checks
    if (parsed.intent === 'edit_objects' && parsed.edits) {
      const validEdits = parsed.edits.filter((edit) => {
        // Defensive check for edit.target
        if (!edit || !edit.target) {
          console.warn('Skipping edit with missing target:', edit);
          return false;
        }
        const targetLower = edit.target.toLowerCase();
        return availableObjects.some((obj) => {
          const label = obj.label || obj.name || '';
          return label.toLowerCase() === targetLower;
        });
      });
      parsed.edits = validEdits.length > 0 ? validEdits : undefined;
    }

    // Only fallback to generate_room if no objects available AND no selected object
    if (parsed.intent === 'edit_objects' && (!parsed.edits || parsed.edits.length === 0)) {
      if (availableObjects.length === 0) {
        parsed.intent = 'generate_room';
      } else {
        // If objects exist but edit failed, default to first object
        const firstObjLabel = availableObjects[0].label || availableObjects[0].name || 'object';
        parsed.intent = 'edit_objects';
        parsed.edits = [{
          target: firstObjLabel,
          action: 'modify',
          attributes: {
            description: userText,
            request: userText,
          },
        }];
      }
    }

    return parsed;
  } catch (error) {
    console.error('Parser error:', error);
    console.error('Input text:', userText);
    console.error('Available objects:', availableObjects);

    // Throw error instead of returning malformed edit_objects without edits array
    throw new Error(
      `Failed to parse instruction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

