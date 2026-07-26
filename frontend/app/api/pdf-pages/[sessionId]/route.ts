import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const resolvedParams = await params;
    let sessionId = resolvedParams.sessionId;

    const myAgentDir = path.resolve(process.cwd(), '..', 'my-agent');
    const pdfImagesDir = path.join(myAgentDir, 'pdf_images');
    const sessionsDir = path.join(myAgentDir, 'tutor_sessions');

    // If 'latest', resolve to the most recently modified session
    if (sessionId === 'latest') {
      if (fs.existsSync(sessionsDir)) {
        const files = fs.readdirSync(sessionsDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(sessionsDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          sessionId = path.basename(files[0].name, '.json');
        }
      }
    }

    if (!sessionId || sessionId === 'latest') {
      // Fallback: search pdf_images folders
      if (fs.existsSync(pdfImagesDir)) {
        const dirs = fs.readdirSync(pdfImagesDir)
          .map((d) => ({
            name: d,
            mtime: fs.statSync(path.join(pdfImagesDir, d)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (dirs.length > 0) {
          sessionId = dirs[0].name;
        }
      }
    }

    const sessionImagesDir = path.join(pdfImagesDir, sessionId);
    let pdfName = 'PDF Document';
    let totalPages = 0;

    // Check if session JSON metadata exists
    const sessionJsonFile = path.join(sessionsDir, `${sessionId}.json`);
    if (fs.existsSync(sessionJsonFile)) {
      try {
        const meta = JSON.parse(fs.readFileSync(sessionJsonFile, 'utf-8'));
        if (meta.pdf_name) pdfName = meta.pdf_name;
        if (meta.total_pages) totalPages = meta.total_pages;
      } catch {
        /* ignore */
      }
    }

    const pages: { pageNum: number; pageImage: string }[] = [];

    if (fs.existsSync(sessionImagesDir)) {
      const files = fs.readdirSync(sessionImagesDir);
      for (const file of files) {
        const match = file.match(/^pdf_page_(\d+)\.png$/);
        if (match) {
          const pageNum = parseInt(match[1], 10);
          pages.push({
            pageNum,
            pageImage: `${sessionId}/${file}`,
          });
        }
      }
      pages.sort((a, b) => a.pageNum - b.pageNum);
    }

    if (totalPages === 0) totalPages = pages.length;

    return NextResponse.json({
      sessionId,
      pdfName,
      totalPages,
      pages,
    });
  } catch (error) {
    console.error('[pdf-pages route] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
