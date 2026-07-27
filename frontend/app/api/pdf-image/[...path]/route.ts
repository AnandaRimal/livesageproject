import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const resolvedParams = await params;
    const pathParts = resolvedParams.path || [];

    if (pathParts.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    const myAgentDir = path.resolve(process.cwd(), '..', 'my-agent');
    const imagesDir = path.join(myAgentDir, 'pdf_images');

    // Prevent directory traversal
    const safePath = pathParts.map((p) => path.basename(p)).join(path.sep);
    const fullPath = path.join(imagesDir, safePath);

    if (!fs.existsSync(fullPath)) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, immutable',
      },
    });
  } catch (error) {
    console.error('[pdf-image route] Error serving image:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
