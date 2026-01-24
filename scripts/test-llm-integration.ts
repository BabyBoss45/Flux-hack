#!/usr/bin/env tsx

/**
 * LLM Integration Test Script
 *
 * Tests the LLM floor plan analysis service integration:
 * 1. Health check
 * 2. Analyze sample floor plan (if test fixture exists)
 * 3. Measure latency and validate response format
 *
 * Usage: npx tsx scripts/test-llm-integration.ts
 */

import * as llmClient from '../lib/llm/client';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function log(color: string, message: string) {
  console.log(`${color}${message}${RESET}`);
}

async function testHealthCheck() {
  console.log('\n📋 Test 1: Health Check');
  console.log('─────────────────────────────────────');

  try {
    const startTime = Date.now();
    const result = await llmClient.healthCheck();
    const latency = Date.now() - startTime;

    if (result.reachable) {
      log(GREEN, `✓ LLM service is reachable (${latency}ms)`);
      return true;
    } else {
      log(RED, `✗ LLM service is unreachable: ${result.error}`);
      return false;
    }
  } catch (error) {
    log(RED, `✗ Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testAnalyzeFloorPlan() {
  console.log('\n📋 Test 2: Analyze Sample Floor Plan');
  console.log('─────────────────────────────────────');

  // Check for test fixture
  const fixturePath = path.join(process.cwd(), 'test-fixtures', 'sample-floorplan.png');

  if (!existsSync(fixturePath)) {
    log(YELLOW, '⚠ No test fixture found at test-fixtures/sample-floorplan.png');
    log(YELLOW, '  Skipping analysis test. To enable this test, add a sample floor plan image.');
    return null;
  }

  try {
    const fileBuffer = readFileSync(fixturePath);
    const startTime = Date.now();

    log(YELLOW, '⏳ Analyzing floor plan (this may take 30-60 seconds)...');

    const result = await llmClient.analyzeFloorPlan(fileBuffer, 'sample-floorplan.png');
    const latency = Date.now() - startTime;

    // Validate response structure
    const validations = [
      { check: Array.isArray(result.rooms), name: 'rooms is array' },
      { check: typeof result.annotated_image_base64 === 'string', name: 'annotated_image_base64 is string' },
      { check: typeof result.room_count === 'number', name: 'room_count is number' },
      { check: typeof result.total_area_sqft === 'number', name: 'total_area_sqft is number' },
      { check: result.room_count === result.rooms.length, name: 'room_count matches rooms array length' },
    ];

    let allValid = true;
    for (const validation of validations) {
      if (validation.check) {
        log(GREEN, `  ✓ ${validation.name}`);
      } else {
        log(RED, `  ✗ ${validation.name}`);
        allValid = false;
      }
    }

    if (allValid) {
      log(GREEN, `✓ Analysis successful (${(latency / 1000).toFixed(1)}s)`);
      log(GREEN, `  Detected ${result.room_count} rooms, total area: ${result.total_area_sqft.toFixed(0)} sqft`);

      // Show room details
      if (result.rooms.length > 0) {
        console.log('\n  Detected rooms:');
        result.rooms.forEach((room, i) => {
          console.log(`    ${i + 1}. ${room.name} (${room.type}) - ${room.dimensions.area_sqft.toFixed(0)} sqft`);
        });
      }

      return true;
    } else {
      log(RED, '✗ Response validation failed');
      return false;
    }
  } catch (error) {
    log(RED, `✗ Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  LLM Floor Plan Integration Test Suite   ║');
  console.log('╚═══════════════════════════════════════════╝');

  const results = {
    healthCheck: await testHealthCheck(),
    analysis: await testAnalyzeFloorPlan(),
  };

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  Test Summary                             ║');
  console.log('╚═══════════════════════════════════════════╝');

  console.log(`\nHealth Check:    ${results.healthCheck ? GREEN + '✓ PASS' : RED + '✗ FAIL'}${RESET}`);
  console.log(`Analysis Test:   ${results.analysis === null ? YELLOW + '⚠ SKIPPED' : results.analysis ? GREEN + '✓ PASS' : RED + '✗ FAIL'}${RESET}`);

  const allPassed = results.healthCheck && (results.analysis === null || results.analysis);

  if (allPassed) {
    log(GREEN, '\n✓ All tests passed!');
    process.exit(0);
  } else {
    log(RED, '\n✗ Some tests failed');
    console.log('\nTroubleshooting:');
    console.log('  • Ensure the LLM service is running: cd LLM && uv run uvicorn src.api:app --port 8000');
    console.log('  • Check that API keys are configured in LLM/.env');
    console.log('  • Verify network connectivity to RasterScan and Anthropic APIs');
    process.exit(1);
  }
}

main();
