# Image Generation & Editing Features Review

**Project**: Flux-hack
**Review Date**: January 27, 2026
**Branch**: feat/nano-banana

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Implementation Analysis](#current-implementation-analysis)
   - [Image Generation Features](#image-generation-features)
   - [Image Editing Features](#image-editing-features)
3. [Best Practices Comparison](#best-practices-comparison)
4. [Gap Analysis](#gap-analysis)
5. [Recommendations](#recommendations)
6. [Priority Action Items](#priority-action-items)

---

## Executive Summary

This review provides a comprehensive analysis of the image generation and editing features in the Flux-hack codebase, compared against industry best practices for 2024-2026. The application is a floor plan analysis and room design system that leverages multiple AI services for image analysis, generation, and manipulation.

### Key Findings

| Area | Current State | Industry Standard | Gap Level |
|------|---------------|-------------------|-----------|
| Image Generation | Runware API + Claude Vision | Multi-model support | Medium |
| Inpainting | Implemented with masking | Advanced techniques available | Low |
| Error Handling | Basic implementation | Exponential backoff + fallbacks | Medium |
| Caching | Not implemented | Multi-layer CDN caching | High |
| Rate Limiting | Timeout-based only | Token bucket algorithm | High |
| Progress Indicators | Basic loading states | Determinate progress bars | Medium |
| Accessibility | Not implemented | WCAG 2.2 compliance | High |
| Cost Optimization | Not implemented | Batch processing + caching | High |

---

## Current Implementation Analysis

### Image Generation Features

#### 1. AI Models & APIs Used

| Service | Purpose | Location |
|---------|---------|----------|
| **Claude Sonnet 4** | Vision analysis (floor plans, furniture, button positions) | `src/floor_plan_analyzer.py:53`, `src/furniture_analyzer.py:43` |
| **RasterScan API** | Room segmentation and vector overlay | `src/floor_plan_analyzer.py:49` |
| **Runware API** | Image generation (text-to-image, image-to-image, inpainting) | `lib/klein/runware-client.ts` |
| **ThorData/ScrapeAPI** | Product search via Google Shopping | `src/product_search.py:34` |
| **ImgBB** | Temporary image hosting for visual search | `src/product_search.py:156` |

#### 2. Generation Endpoints

```
POST /analyze              → Floor plan analysis with room detection
POST /analyze/image        → Returns annotated PNG directly
POST /analyze-furniture    → Furniture identification
POST /analyze-and-shop     → Combined furniture + shopping
POST /visual-search        → Product search by description
POST /api/images/generate  → Room image generation
POST /api/images/edit      → Image editing with masks
POST /api/rooms/[id]/generate-image → Context-aware room generation
```

#### 3. Generation Parameters

**Floor Plan Analysis:**
- Overlay alpha: 140 (transparency level)
- Min room size filter: 30 sqft
- Supported formats: PNG, JPEG, GIF, WebP
- Max file size: 20MB

**Room Image Generation (Runware):**
- Default resolution: 1024x1024
- Steps: 30
- CFG Scale: 7.5
- Model: runware:400@4
- Output format: JPG

**Dynamic Resolution Calculation:**
```
Ratio ≥ 1.7  → 1920x1080 (16:9 landscape)
Ratio ≥ 1.3  → 1536x1024 (3:2 landscape)
Ratio ≥ 0.9  → 1024x1024 (1:1 square)
Ratio ≥ 0.7  → 1024x1536 (3:2 portrait)
Default      → 1080x1920 (16:9 portrait)
```

#### 4. Generation Pipelines

**Floor Plan Analysis Pipeline:**
1. Image validation (extension, size, empty check)
2. Format detection and RGBA conversion
3. RasterScan API call for overlay
4. Claude Vision analysis for room extraction
5. Room filtering (< 30 sqft excluded)
6. Image compositing (original + overlay)
7. Button position extraction
8. Area calculation and result assembly

**Furniture Analysis Pipeline:**
1. Image preparation and base64 encoding
2. Claude Vision analysis with furniture prompt
3. JSON parsing and validation
4. Category filtering (valid furniture types only)
5. Color code verification

### Image Editing Features

#### 1. Task Types Supported

| Task Type | Description | Location |
|-----------|-------------|----------|
| **imageInference** | Text-to-image generation | `lib/klein/runware-client.ts:17` |
| **imageToImage** | Style/structure transformation | `lib/klein/task-builder.ts:17-27` |
| **imageInpainting** | Selective area editing with masks | `lib/klein/types.ts:53-61` |

#### 2. Masking Implementation

**Mask Creation (`lib/klein/task-builder.ts:206-258`):**
- Converts normalized bounding box to pixel coordinates
- Applies 7.5% padding around mask area
- Clamps to 1024x1024 bounds
- Validates mask area < 30% of image

**Inpainting Prompt Generation:**
- Restrictive prompt pattern to prevent image drift
- Preserves layout, lighting, camera angle
- Prevents modification of non-target elements

#### 3. Intent Classification (`lib/klein/parser.ts`)

| Intent | Trigger | Action |
|--------|---------|--------|
| `generate_room` | No existing image | Full generation |
| `regenerate_room` | Overall style/color change | Image-to-image with 0.65 strength |
| `edit_objects` | Specific object change | Inpainting with 0.85 strength |

#### 4. Object Detection & Tracking

- Claude Vision API for object detection
- Detected objects stored in database for sequential edits
- Categories: furniture, surface, lighting, architectural
- Bounding boxes maintained as [x1, y1, x2, y2]

#### 5. Image Export & Storage

**Export Features:**
- Download as JPEG via browser API
- PDF export for shopping lists
- Base64 encoding for API responses

**Storage:**
- Stateless design (no server-side persistence)
- Images returned as base64 or URLs
- Database stores URLs, prompts, view types, detected items

#### 6. UI Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `RoomImageViewer` | Display with bbox overlays | `components/rooms/room-image-viewer.tsx` |
| `ItemEditDialog` | Edit prompts with suggestions | `components/chat/item-edit-dialog.tsx` |
| `ImageGeneration` | Loading state animation | `components/ui/ai-chat-image-generation-1.tsx` |
| `FullscreenImageViewer` | Expanded view with interactions | `components/rooms/room-image-viewer.tsx:395` |

---

## Best Practices Comparison

### 1. UX/UI Patterns

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Transparency about AI actions | Basic status messages | ⚠️ Partial |
| Style galleries for prompt assistance | Not implemented | ❌ Missing |
| Prompt enhancement/rewrite | `enhancePrompt()` in `lib/ai/prompts.ts` | ✅ Implemented |
| Model-specific prompting | Single prompt style | ⚠️ Partial |
| Structured prompt framework | Intent parsing implemented | ✅ Implemented |

### 2. Progress Indicators

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| < 1 second: No indicator | N/A | ✅ |
| 1-3 seconds: Simple animation | Spinner implemented | ✅ Implemented |
| > 3 seconds: Progress bar | 30-second animation, no real progress | ⚠️ Partial |
| Determinate progress for known durations | Not implemented | ❌ Missing |
| Screen reader support | Not implemented | ❌ Missing |

### 3. Error Handling

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Transient vs permanent error classification | Not implemented | ❌ Missing |
| Exponential backoff | Not implemented | ❌ Missing |
| Jittered backoff (thundering herd prevention) | Not implemented | ❌ Missing |
| Maximum retry counts | Not implemented | ❌ Missing |
| Descriptive error messages | Basic HTTP exceptions | ⚠️ Partial |
| Fallback models | Not implemented | ❌ Missing |
| Production testing for failures | Not evident | ❌ Missing |

### 4. Cost Optimization

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Batch API processing | Not implemented | ❌ Missing |
| Quality selection optimization | Fixed settings | ❌ Missing |
| Prompt optimization (token reduction) | `sanitizePrompt()` truncates to 1800 chars | ⚠️ Partial |
| Resolution management | Dynamic calculation | ✅ Implemented |
| Caching layer | Not implemented | ❌ Missing |
| Third-party provider optimization | Single provider | ⚠️ Partial |

### 5. Caching Strategies

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Origin cache | Not implemented | ❌ Missing |
| Edge cache | Not implemented | ❌ Missing |
| Cache-Control headers | 1-year cache for uploads | ✅ Implemented |
| Content versioning | Not implemented | ❌ Missing |
| 80-95% cache hit ratio target | No metrics | ❌ Missing |

### 6. Security

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Content moderation | Not implemented | ❌ Missing |
| Prompt injection protection | Not implemented | ❌ Missing |
| Rate limiting (token bucket) | Timeout-based only | ⚠️ Partial |
| Multi-layer limits | Not implemented | ❌ Missing |
| HTTP 429 with proper headers | Not implemented | ❌ Missing |
| Watermarking for AI content | Not implemented | ❌ Missing |

### 7. Canvas & Editing

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| WebGL for performance | Not using canvas | N/A |
| OffscreenCanvas + Workers | Not implemented | N/A |
| Batch rendering | React-based rendering | ⚠️ Different approach |
| Dirty flag optimization | Not implemented | ⚠️ Partial |
| Layer optimization | Object-based layers | ✅ Implemented |

### 8. Real-Time Collaboration

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| CRDTs for offline-first | Not implemented | ❌ Missing |
| Operational Transformation | Not implemented | ❌ Missing |
| Multi-user editing | Single user only | ❌ Missing |

### 9. Accessibility

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| ARIA roles on interactive elements | Limited | ⚠️ Partial |
| Keyboard navigation | Not fully implemented | ⚠️ Partial |
| Screen reader support | Not implemented | ❌ Missing |
| Color contrast compliance | Not verified | ⚠️ Unknown |
| WCAG 2.2 compliance | Not implemented | ❌ Missing |

### 10. Inpainting

| Best Practice | Current Implementation | Status |
|---------------|----------------------|--------|
| Precise masking | Bounding box with padding | ✅ Implemented |
| Mask area validation | < 30% limit | ✅ Implemented |
| Structured prompts | "Preserve layout/lighting" | ✅ Implemented |
| Model selection by task | Fixed model | ⚠️ Partial |
| Denoise strength tuning | 0.65-0.85 based on task | ✅ Implemented |

---

## Gap Analysis

### Critical Gaps (High Priority)

1. **No Rate Limiting Infrastructure**
   - Current: Only timeout-based controls (30-60 seconds)
   - Risk: API abuse, cost overruns, service degradation
   - Impact: High

2. **No Caching Layer**
   - Current: Images generated fresh each time
   - Risk: Unnecessary API costs, slow responses
   - Impact: High (cost + performance)

3. **No Error Recovery/Retry Logic**
   - Current: Single attempt, fail on error
   - Risk: Poor user experience, lost work
   - Impact: High

4. **No Accessibility Implementation**
   - Current: Basic HTML semantics only
   - Risk: Legal compliance, user exclusion
   - Impact: High (regulatory risk)

5. **No Content Moderation**
   - Current: Prompts passed directly to APIs
   - Risk: Inappropriate content generation
   - Impact: High (brand/legal risk)

### Moderate Gaps (Medium Priority)

6. **Limited Progress Feedback**
   - Current: Indeterminate spinner only
   - Improvement: Determinate progress for long operations

7. **No Batch Processing**
   - Current: Sequential API calls
   - Improvement: Parallel/batch for cost savings

8. **Single Model Dependency**
   - Current: Claude Sonnet 4 + Runware only
   - Improvement: Fallback models for resilience

9. **No Prompt Engineering UI**
   - Current: Free-form text input
   - Improvement: Style galleries, structured inputs

### Minor Gaps (Lower Priority)

10. **No Image Quality Selection**
    - Current: Fixed quality settings
    - Improvement: User-selectable quality/cost tradeoff

11. **No Real-Time Collaboration**
    - Current: Single-user editing
    - Improvement: CRDT-based multi-user support

12. **Limited Export Options**
    - Current: JPEG download, PDF shopping list
    - Improvement: Multiple formats, resolution options

---

## Recommendations

### Immediate Actions (0-4 weeks)

#### 1. Implement Rate Limiting

```typescript
// Recommended: Token Bucket Algorithm
interface RateLimiter {
  maxTokens: number;      // e.g., 100
  refillRate: number;     // tokens per second
  currentTokens: number;
}

// Per-user, per-endpoint limits
// Return HTTP 429 with headers:
// - X-RateLimit-Limit
// - X-RateLimit-Remaining
// - X-RateLimit-Reset
// - Retry-After
```

**Files to modify:**
- Create `lib/rate-limiter.ts`
- Update `app/api/*/route.ts` endpoints

#### 2. Add Exponential Backoff with Retry

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter: boolean;
  }
): Promise<T> {
  // Classify errors as transient vs permanent
  // Apply exponential backoff: delay = baseDelay * 2^attempt
  // Add jitter to prevent thundering herd
}
```

**Files to modify:**
- `src/floor_plan_analyzer.py` - RasterScan API calls
- `src/product_search.py` - ThorData API calls
- `lib/klein/runware-client.ts` - Runware API calls

#### 3. Add Basic Content Moderation

```typescript
// Pre-generation prompt check
const blockedTerms = [...];
const warningTerms = [...];

function moderatePrompt(prompt: string): ModerationResult {
  // Check for blocked/warning terms
  // Log flagged attempts
  // Return modified or rejected prompt
}
```

**Files to modify:**
- Create `lib/content-moderation.ts`
- Update `lib/ai/prompts.ts`

### Short-Term Actions (1-3 months)

#### 4. Implement Caching Layer

**Architecture:**
```
User Request
    ↓
[Cache Check] → Hit → Return cached image
    ↓ Miss
[Generation] → Store in cache → Return image
```

**Recommended approach:**
- Redis for prompt→URL mapping
- CDN (Cloudflare, imgix) for image delivery
- 60-day TTL for generated images
- Content versioning for cache invalidation

**Files to create:**
- `lib/cache/redis-client.ts`
- `lib/cache/image-cache.ts`

#### 5. Add Accessibility (WCAG 2.2)

**Priority areas:**
1. Keyboard navigation for image viewer
2. ARIA labels on bounding box overlays
3. Screen reader announcements for generation status
4. Color contrast verification
5. Focus management in dialogs

**Files to modify:**
- `components/rooms/room-image-viewer.tsx`
- `components/chat/item-edit-dialog.tsx`
- `components/ui/ai-chat-image-generation-1.tsx`

#### 6. Improve Progress Indicators

```typescript
// Track generation stages
enum GenerationStage {
  VALIDATING = 'Validating input...',
  QUEUED = 'Queued for generation...',
  GENERATING = 'Generating image...',
  PROCESSING = 'Processing results...',
  COMPLETE = 'Complete!'
}

// Estimate progress based on typical durations
// Show determinate progress bar when possible
```

**Files to modify:**
- `components/ui/ai-chat-image-generation-1.tsx`
- Create `lib/progress-tracker.ts`

### Medium-Term Actions (3-6 months)

#### 7. Multi-Model Fallback System

```typescript
const modelPriority = [
  { provider: 'runware', model: 'runware:400@4' },
  { provider: 'stability', model: 'sdxl-1.0' },
  { provider: 'openai', model: 'dall-e-3' }
];

async function generateWithFallback(params: GenerationParams) {
  for (const model of modelPriority) {
    try {
      return await generateImage(model, params);
    } catch (error) {
      if (isPermanentError(error)) throw error;
      continue; // Try next model
    }
  }
  throw new Error('All generation providers failed');
}
```

#### 8. Prompt Engineering UI

**Components to add:**
- Style gallery picker (modern, minimalist, industrial, etc.)
- Color palette selector
- Lighting presets (natural, warm, dramatic)
- View angle selector (perspective, overhead, wide)
- Prompt history/favorites

#### 9. Cost Optimization Dashboard

**Metrics to track:**
- API calls per endpoint per day
- Cost per generation
- Cache hit ratio
- Average generation time
- Error rates by provider

**Actions:**
- Implement batch processing for product searches
- Add quality tiers (draft/standard/high)
- Optimize prompts to reduce token usage

### Long-Term Actions (6+ months)

#### 10. Real-Time Collaboration

- Implement CRDT (Yjs or Automerge) for state sync
- Add presence indicators
- Support multiple cursors on floor plans
- Conflict resolution for concurrent edits

#### 11. Advanced Canvas Editing

- Consider Fabric.js or Konva.js integration
- Add freehand drawing for masks
- Implement lasso selection tool
- Support WebGL for performance

---

## Priority Action Items

### P0 - Critical (This Sprint)

| # | Action | Effort | Impact | Owner |
|---|--------|--------|--------|-------|
| 1 | Implement rate limiting | 2-3 days | High | Backend |
| 2 | Add retry logic with exponential backoff | 2 days | High | Backend |
| 3 | Basic content moderation | 1-2 days | High | Backend |

### P1 - High Priority (Next 4 Weeks)

| # | Action | Effort | Impact | Owner |
|---|--------|--------|--------|-------|
| 4 | Redis caching for generated images | 1 week | High | Backend |
| 5 | Improve error messages (user-facing) | 2-3 days | Medium | Full stack |
| 6 | Keyboard accessibility for image viewer | 3-4 days | High | Frontend |

### P2 - Medium Priority (1-3 Months)

| # | Action | Effort | Impact | Owner |
|---|--------|--------|--------|-------|
| 7 | Determinate progress indicators | 1 week | Medium | Frontend |
| 8 | WCAG 2.2 accessibility audit & fixes | 2 weeks | High | Frontend |
| 9 | Multi-model fallback system | 1 week | Medium | Backend |
| 10 | Cost tracking dashboard | 1 week | Medium | Full stack |

### P3 - Lower Priority (3-6 Months)

| # | Action | Effort | Impact | Owner |
|---|--------|--------|--------|-------|
| 11 | Prompt engineering UI components | 2 weeks | Medium | Frontend |
| 12 | Batch processing for APIs | 1 week | Medium | Backend |
| 13 | Quality tier selection | 3-4 days | Low | Full stack |

---

## Appendix A: Code Location Reference

### Python Backend (LLM/src/)

| File | Purpose |
|------|---------|
| `api.py` | FastAPI endpoints |
| `floor_plan_analyzer.py` | Floor plan analysis with Claude + RasterScan |
| `furniture_analyzer.py` | Furniture detection with Claude Vision |
| `button_position_analyzer.py` | UI button positioning |
| `product_search.py` | Google Shopping integration |

### TypeScript Frontend (app/, lib/, components/)

| File | Purpose |
|------|---------|
| `app/api/images/generate/route.ts` | Image generation endpoint |
| `app/api/images/edit/route.ts` | Image editing endpoint |
| `lib/klein/runware-client.ts` | Runware API client |
| `lib/klein/task-builder.ts` | Generation task construction |
| `lib/klein/parser.ts` | User intent classification |
| `lib/ai/prompts.ts` | Prompt enhancement utilities |
| `components/rooms/room-image-viewer.tsx` | Image display with overlays |

---

## Appendix B: Best Practices Sources

### Image Generation

1. [Designing with AI: UX Considerations - Medium](https://medium.com/@mariamargarida/designing-with-ai-ux-considerations-and-best-practices-5c6b69b92c4c)
2. [How to Write AI Image Prompts - Let's Enhance](https://letsenhance.io/blog/article/ai-text-prompt-guide/)
3. [Progress Indicators Guide - Number Analytics](https://www.numberanalytics.com/blog/progress-indicators-ultimate-guide-ui-ux)
4. [Mastering Retry Logic - SparkCo](https://sparkco.ai/blog/mastering-retry-logic-agents-a-deep-dive-into-2025-best-practices)
5. [CDN Caching Best Practices - Cloudinary](https://cloudinary.com/glossary/cdn-caching)
6. [Rate Limiting Algorithms - AlgoMaster](https://blog.algomaster.io/p/rate-limiting-algorithms-explained-with-code)

### Image Editing

1. [MDN - Using Images on Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images)
2. [Real-Time Collaboration: OT vs CRDT - TinyMCE](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/)
3. [Runware Inpainting Documentation](https://runware.ai/docs/image-inference/inpainting)
4. [MDN - Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
5. [Konva.js vs Fabric.js - Medium](https://medium.com/@www.blog4j.com/konva-js-vs-fabric-js-in-depth-technical-comparison-and-use-case-analysis-9c247968dd0f)
6. [WCAG in 2025 - Medium](https://medium.com/@alendennis77/wcag-in-2025-trends-pitfalls-practical-implementation-8cdc2d6e38ad)

---

*Document generated as part of code review process.*
