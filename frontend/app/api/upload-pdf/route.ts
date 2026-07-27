import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No PDF file uploaded' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    // Prepare paths
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const myAgentDir = path.resolve(process.cwd(), '..', 'my-agent');
    const uploadsDir = path.join(myAgentDir, 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const pdfPath = path.join(uploadsDir, `${sessionId}_${safeFileName}`);

    await fs.promises.writeFile(pdfPath, buffer);

    // Return a ReadableStream (SSE / Chunked stream) so the frontend gets real-time progress
    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (data: unknown) => {
          try {
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          } catch {
            // Controller closed
          }
        };

        // Determine python executable (prefer venv if available)
        let pythonCmd = 'python';
        const venvPythonWin = path.join(myAgentDir, '.venv', 'Scripts', 'python.exe');
        const venvPythonUnix = path.join(myAgentDir, '.venv', 'bin', 'python');

        if (fs.existsSync(venvPythonWin)) {
          pythonCmd = venvPythonWin;
        } else if (fs.existsSync(venvPythonUnix)) {
          pythonCmd = venvPythonUnix;
        }

        const child = spawn(
          pythonCmd,
          ['aitutor.py', '--process-pdf', pdfPath, '--session-id', sessionId],
          { cwd: myAgentDir }
        );

        let bufferStr = '';

        child.stdout.on('data', (chunk) => {
          bufferStr += chunk.toString();
          const lines = bufferStr.split('\n');
          bufferStr = lines.pop() || ''; // Keep remainder

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              sendEvent(parsed);
            } catch {
              // Raw logs
              console.log('[aitutor py stdout]:', trimmed);
            }
          }
        });

        child.stderr.on('data', (data) => {
          console.error('[aitutor py stderr]:', data.toString());
        });

        child.on('close', (code) => {
          if (code === 0) {
            sendEvent({ type: 'done', session_id: sessionId });
          } else {
            sendEvent({ type: 'error', message: `Process exited with code ${code}` });
          }
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });

        child.on('error', (err) => {
          console.error('Failed to start python child process:', err);
          sendEvent({ type: 'error', message: err.message });
          try {
            controller.close();
          } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[upload-pdf route] Error:', error);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
