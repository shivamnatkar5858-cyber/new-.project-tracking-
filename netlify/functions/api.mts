// Runs the ProjectTrack Express REST API (backend-api.ts) as a Netlify Function.
// App state and uploaded files are persisted in Netlify Blobs between invocations.
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import fs from 'fs';

const STATE_KEY = 'state';

type Api = typeof import('../../backend-api.ts');
let ready: Promise<{ api: Api; port: number }> | undefined;

function start() {
  return (ready ??= (async () => {
    // Function bundles are read-only, so the API's disk files go to the temp dir
    process.env.PROJECTTRACK_DATA_DIR = path.join(os.tmpdir(), 'projecttrack');
    const express = (await import('express')).default;
    const api = await import('../../backend-api.ts');

    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use('/api', api.default);

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    return { api, port: (server.address() as AddressInfo).port };
  })());
}

async function serveUpload(name: string) {
  const file = await getStore('uploads').getWithMetadata(name, { type: 'arrayBuffer' });
  if (!file) return new Response('File not found', { status: 404 });
  return new Response(file.data, {
    headers: {
      'Content-Type': (file.metadata.contentType as string) || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${name}"`
    }
  });
}

async function persistUploads(dir: string) {
  if (!fs.existsSync(dir)) return;
  const store = getStore('uploads');
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const data = fs.readFileSync(filePath);
    await store.set(name, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    fs.unlinkSync(filePath);
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith('/uploads/')) {
    return serveUpload(decodeURIComponent(url.pathname.slice('/uploads/'.length)));
  }

  const { api, port } = await start();
  const stateStore = getStore({ name: 'projecttrack', consistency: 'strong' });

  // Sync in-memory state with the latest persisted copy
  api.importState(await stateStore.get(STATE_KEY, { type: 'json' }));
  api.consumeDirty();

  const headers = new Headers(req.headers);
  headers.delete('host');
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined
  });
  const body = await upstream.arrayBuffer();

  if (api.consumeDirty()) {
    await stateStore.setJSON(STATE_KEY, api.exportState());
  }
  await persistUploads(api.uploadDir);

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('connection');
  return new Response(body, { status: upstream.status, headers: responseHeaders });
};

export const config: Config = {
  path: ['/api/*', '/uploads/*'],
  preferStatic: true
};
