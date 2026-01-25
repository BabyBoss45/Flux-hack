import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/mock-auth';
import { saveFile, saveBase64Image } from '@/lib/storage/blob';
import { updateProject, getProjectById, createRoom } from '@/lib/db/queries';
import * as llmClient from '@/lib/llm/client';

export const maxDuration = 240; // 4 minute timeout (increased to allow for LLM processing)

interface SSEEvent {
  event: string;
  data: any;
}

function formatSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const projectIdStr = formData.get('projectId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!projectIdStr) {
      return NextResponse.json({ error: 'No project ID provided' }, { status: 400 });
    }

    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    // Verify project ownership
    const project = getProjectById(projectId);
    if (!project || project.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log(`[upload-and-analyse] Request received: projectId=${projectId}, filename=${file.name}, size=${(file.size / 1024 / 1024).toFixed(2)}MB, user=${session.user.id}`);

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF or image file.' },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 20MB.' },
        { status: 400 }
      );
    }

    console.log(`[upload-and-analyse] File validated: type=${file.type}, size=${(file.size / 1024 / 1024).toFixed(2)}MB`);

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send analyzing event
          controller.enqueue(
            encoder.encode(
              formatSSE({
                event: 'progress',
                data: { status: 'analyzing', message: 'Analyzing floor plan with AI...' },
              })
            )
          );

          // Convert file to buffer for LLM service
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);

          // Call LLM service
          let analysisResult: llmClient.LLMAnalysisResult;
          try {
            console.log(`[upload-and-analyse] Calling LLM service for analysis...`);
            const analysisStartTime = Date.now();
            analysisResult = await llmClient.analyzeFloorPlan(buffer, file.name);
            const analysisTime = Date.now() - analysisStartTime;
            console.log(`[upload-and-analyse] LLM analysis complete: ${analysisResult.room_count} rooms detected, ${analysisResult.total_area_sqft} sqft, took ${analysisTime}ms`);
          } catch (error) {
            controller.enqueue(
              encoder.encode(
                formatSSE({
                  event: 'error',
                  data: {
                    error: error instanceof Error ? error.message : 'Analysis failed',
                  },
                })
              )
            );
            controller.close();
            return;
          }

          // Send uploading event
          controller.enqueue(
            encoder.encode(
              formatSSE({
                event: 'progress',
                data: { status: 'uploading', message: 'Saving images...' },
              })
            )
          );

          // Save original floor plan
          const { url: floor_plan_url } = await saveFile(file, 'floor-plans');
          console.log(`[upload-and-analyse] Original floor plan saved: ${floor_plan_url}`);

          // Save annotated image
          const { url: annotated_floor_plan_url } = await saveBase64Image(
            analysisResult.annotated_image_base64,
            'floor-plans'
          );
          console.log(`[upload-and-analyse] Annotated floor plan saved: ${annotated_floor_plan_url}`);

          // Update project with both URLs
          updateProject(projectId, {
            floor_plan_url,
            annotated_floor_plan_url,
          });

          // Create room records
          const rooms = [];
          for (const llmRoom of analysisResult.rooms) {
            const room = createRoom(projectId, llmRoom.name, llmRoom.type, {
              geometry: JSON.stringify(llmRoom.dimensions),
              doors: JSON.stringify(llmRoom.doors),
              windows: JSON.stringify(llmRoom.windows),
              fixtures: JSON.stringify(llmRoom.fixtures),
              adjacent_rooms: JSON.stringify(llmRoom.adjacent_rooms),
            });
            if (room) {
              rooms.push(room);
            }
          }
          console.log(`[upload-and-analyse] Created ${rooms.length} room records in database`);

          // Send complete event
          console.log(`[upload-and-analyse] Upload flow complete: projectId=${projectId}, rooms=${rooms.length}`);
          controller.enqueue(
            encoder.encode(
              formatSSE({
                event: 'complete',
                data: {
                  floor_plan_url,
                  annotated_floor_plan_url,
                  rooms,
                  room_count: analysisResult.room_count,
                  total_area_sqft: analysisResult.total_area_sqft,
                },
              })
            )
          );

          controller.close();
        } catch (error) {
          console.error(`[upload-and-analyse] Error during upload flow:`, error);
          controller.enqueue(
            encoder.encode(
              formatSSE({
                event: 'error',
                data: {
                  error: error instanceof Error ? error.message : 'Upload failed',
                },
              })
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error(`[upload-and-analyse] Error during upload flow:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
