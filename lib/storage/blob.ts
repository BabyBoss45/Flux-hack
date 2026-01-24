import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = 'public/uploads';

export async function ensureUploadDir(): Promise<void> {
  const fullPath = path.join(process.cwd(), UPLOAD_DIR);
  if (!existsSync(fullPath)) {
    await mkdir(fullPath, { recursive: true });
  }
}

export async function saveFile(
  file: File,
  subfolder?: string
): Promise<{ url: string; filename: string }> {
  await ensureUploadDir();

  const ext = path.extname(file.name) || '.bin';
  const filename = `${uuidv4()}${ext}`;
  const relativePath = subfolder
    ? path.join(UPLOAD_DIR, subfolder, filename)
    : path.join(UPLOAD_DIR, filename);

  const fullPath = path.join(process.cwd(), relativePath);

  // Ensure subfolder exists
  if (subfolder) {
    const subfolderPath = path.join(process.cwd(), UPLOAD_DIR, subfolder);
    if (!existsSync(subfolderPath)) {
      await mkdir(subfolderPath, { recursive: true });
    }
  }

  // Convert File to Buffer and save
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await writeFile(fullPath, buffer);

  // Return public URL (relative to public folder)
  const url = `/${relativePath.replace('public/', '')}`;

  return { url, filename };
}

export async function saveBase64Image(
  base64Data: string,
  subfolder?: string
): Promise<{ url: string; filename: string }> {
  await ensureUploadDir();

  // Remove data URL prefix if present and detect format
  let extension = '.jpg';
  if (base64Data.startsWith('data:image/png')) {
    extension = '.png';
  } else if (base64Data.startsWith('data:image/jpeg')) {
    extension = '.jpg';
  } else if (base64Data.startsWith('data:image/gif')) {
    extension = '.gif';
  } else if (base64Data.startsWith('data:image/webp')) {
    extension = '.webp';
  }

  const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  const filename = `${uuidv4()}${extension}`;
  const relativePath = subfolder
    ? path.join(UPLOAD_DIR, subfolder, filename)
    : path.join(UPLOAD_DIR, filename);

  const fullPath = path.join(process.cwd(), relativePath);

  // Ensure subfolder exists
  if (subfolder) {
    const subfolderPath = path.join(process.cwd(), UPLOAD_DIR, subfolder);
    if (!existsSync(subfolderPath)) {
      await mkdir(subfolderPath, { recursive: true });
    }
  }

  await writeFile(fullPath, buffer);

  const url = `/${relativePath.replace('public/', '')}`;

  return { url, filename };
}

export function getPublicUrl(filename: string, subfolder?: string): string {
  if (subfolder) {
    return `/uploads/${subfolder}/${filename}`;
  }
  return `/uploads/${filename}`;
}
