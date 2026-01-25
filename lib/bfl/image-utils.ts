/**
 * Utility functions for image processing
 */

/**
 * Extract dimensions from a base64-encoded image by reading its header.
 * Supports PNG, JPEG, and WEBP formats.
 *
 * @param base64 - Base64 encoded image (with or without data URI prefix)
 * @returns Object with width and height, or null if extraction fails
 */
export function extractImageDimensions(
  base64: string
): { width: number; height: number } | null {
  try {
    // Remove data URI prefix if present
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length < 24) {
      return null;
    }

    // Check for PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      // PNG: dimensions are in the IHDR chunk starting at byte 16
      // Width at bytes 16-19, Height at bytes 20-23 (big-endian)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // Check for JPEG signature: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return extractJpegDimensions(buffer);
    }

    // Check for WEBP signature: RIFF....WEBP
    if (
      buffer[0] === 0x52 && // R
      buffer[1] === 0x49 && // I
      buffer[2] === 0x46 && // F
      buffer[3] === 0x46 && // F
      buffer[8] === 0x57 && // W
      buffer[9] === 0x45 && // E
      buffer[10] === 0x42 && // B
      buffer[11] === 0x50 // P
    ) {
      return extractWebpDimensions(buffer);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract dimensions from a JPEG buffer by parsing SOF markers
 */
function extractJpegDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  let offset = 2; // Skip SOI marker

  while (offset < buffer.length - 8) {
    // Each marker starts with 0xFF
    if (buffer[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = buffer[offset + 1];

    // Skip padding bytes (0xFF)
    if (marker === 0xff) {
      offset++;
      continue;
    }

    // SOF markers (Start of Frame) contain dimensions
    // SOF0 (0xC0) - Baseline DCT
    // SOF1 (0xC1) - Extended sequential DCT
    // SOF2 (0xC2) - Progressive DCT
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      // SOF structure: length (2) + precision (1) + height (2) + width (2)
      if (offset + 9 <= buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      return null;
    }

    // Skip to next marker
    if (offset + 3 < buffer.length) {
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    } else {
      break;
    }
  }

  return null;
}

/**
 * Extract dimensions from a WEBP buffer
 */
function extractWebpDimensions(
  buffer: Buffer
): { width: number; height: number } | null {
  // WEBP can have different formats: VP8, VP8L (lossless), VP8X (extended)
  if (buffer.length < 30) {
    return null;
  }

  // Check chunk type at offset 12
  const chunkType = buffer.subarray(12, 16).toString('ascii');

  if (chunkType === 'VP8 ') {
    // VP8 lossy format
    // Frame tag starts at offset 20, dimensions at offset 26-29
    if (buffer.length >= 30) {
      // VP8 bitstream starts after chunk header
      // Width and height are stored in the frame header
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
  } else if (chunkType === 'VP8L') {
    // VP8L lossless format
    // Signature byte at offset 20, then 4 bytes containing width-1 and height-1
    if (buffer.length >= 25 && buffer[20] === 0x2f) {
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
  } else if (chunkType === 'VP8X') {
    // VP8X extended format
    // Canvas width at bytes 24-26 (3 bytes, little-endian) + 1
    // Canvas height at bytes 27-29 (3 bytes, little-endian) + 1
    if (buffer.length >= 30) {
      const width =
        (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)) + 1;
      const height =
        (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)) + 1;
      return { width, height };
    }
  }

  return null;
}
