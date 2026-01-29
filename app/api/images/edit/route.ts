import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/mock-auth";
import { createRoomImage, getRoomById } from "@/lib/db/queries";

const RUNWARE_API_BASE = "https://api.runware.ai/v1";

function getApiKey(): string {
  const apiKey = process.env.RUNWARE_API_KEY || process.env.BFL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RUNWARE_API_KEY or BFL_API_KEY environment variable is not set",
    );
  }
  return apiKey;
}

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image, prompt, mask, roomId } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    if (!mask) {
      return NextResponse.json(
        { error: "Mask is required for inpainting" },
        { status: 400 },
      );
    }

    console.log("[edit] Starting inpaint request");
    console.log("[edit] prompt:", prompt);
    console.log("[edit] image length:", image?.length);
    console.log("[edit] mask length:", mask?.length);

    // Clean prompt - remove [Inpaint] prefix if present
    const cleanPrompt = prompt.startsWith("[Inpaint]")
      ? prompt.replace("[Inpaint]", "").trim()
      : prompt;

    // Use Runware's direct API with imageInference + seedImage/maskImage for inpainting
    const body = {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      positivePrompt: cleanPrompt,
      model: "bfl:1@2", // BFL FLUX model
      seedImage: `data:image/png;base64,${image}`,
      maskImage: `data:image/png;base64,${mask}`,
      steps: 50,
      CFGScale: 60,
      strength: 0.85,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "PNG",
    };

    console.log("[edit] Sending request to Runware API...");

    const response = await fetch(RUNWARE_API_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify([body]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[edit] Runware API error response:", errorText);
      return NextResponse.json(
        { error: `Runware API error: ${errorText}` },
        { status: 500 },
      );
    }

    const data = await response.json();
    console.log(
      "[edit] Runware response:",
      JSON.stringify(data).substring(0, 500),
    );

    // Parse the response - Runware has various response formats
    const root = Array.isArray(data) ? data[0] : data;
    const firstContainer = root?.data?.[0] ?? root?.tasks?.[0] ?? root;
    const firstResult =
      firstContainer?.results?.[0] ??
      firstContainer?.output?.[0] ??
      firstContainer;

    const imageUrl =
      firstResult?.url ??
      firstResult?.imageURL ??
      firstResult?.imageUrl ??
      root?.imageURL ??
      firstResult?.imageURI;

    if (!imageUrl || typeof imageUrl !== "string") {
      console.error("[edit] No image URL in response:", data);
      return NextResponse.json(
        { error: "Runware API did not return an image URL" },
        { status: 500 },
      );
    }

    console.log("[edit] Got image URL:", imageUrl.substring(0, 100));

    // Save to database if roomId provided and room exists
    if (roomId) {
      const room = getRoomById(Number(roomId));
      if (room) {
        createRoomImage(
          Number(roomId),
          imageUrl,
          `[Inpaint] ${cleanPrompt}`,
          "variation",
          "[]",
        );
        console.log("[edit] Saved image to room:", roomId);
      } else {
        console.log("[edit] Room not found, skipping database save");
      }
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("[edit] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image edit failed" },
      { status: 500 },
    );
  }
}
