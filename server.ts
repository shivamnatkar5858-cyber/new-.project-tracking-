import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import backendApiRouter from './backend-api.ts';

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const hostArgIdx = process.argv.indexOf('--host');
const PORT = Number(
  (portArgIdx !== -1 && process.argv[portArgIdx + 1]) ||
  process.env.DEFAULT_APP_PORT ||
  3000
);
const HOST = (hostArgIdx !== -1 && process.argv[hostArgIdx + 1]) || '0.0.0.0';

// Body Parsers for REST API
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable full CORS for browser and iframe environments
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Mount Complete REST API (No ECONNREFUSED, Instant JSON responses)
app.use('/api', backendApiRouter);

// Downloadable Project Archives & All Data Endpoints
app.get([
  '/projecttrack-all-data.zip',
  '/download-all-data.zip',
  '/download/project-folder',
  '/download/all-data',
  '/api/download/all-data'
], (req, res) => {
  const filePath = path.resolve(process.cwd(), 'projecttrack-all-data.zip');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="projecttrack-all-data.zip"');
    res.download(filePath, 'projecttrack-all-data.zip');
  } else {
    res.status(404).send('Project archive is generating, please refresh in a moment.');
  }
});

// Downloadable Pre-Compiled Dist Archive
app.get(['/dist.zip', '/download/dist.zip', '/projecttrack-dist.zip'], (req, res) => {
  const filePath = path.resolve(process.cwd(), 'dist.zip');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="projecttrack-dist.zip"');
    res.download(filePath, 'projecttrack-dist.zip');
  } else {
    res.status(404).send('Compiled dist archive not found.');
  }
});

// Complete Database & Project Data Export in JSON format
app.get(['/api/export/all-data.json', '/api/export-all-data', '/projecttrack-data.json'], (req, res) => {
  const dataPath = path.resolve(process.cwd(), 'instance', 'projecttrack_data.json');
  if (fs.existsSync(dataPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="projecttrack_all_data.json"');
    res.sendFile(dataPath);
  } else {
    res.json({
      status: 'ok',
      message: 'ProjectTrack Live Data',
      timestamp: new Date().toISOString()
    });
  }
});

// Frontend Page Routing
app.get(['/', '/index', '/index.html'], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'index.html'));
});

app.get([
  '/project%20monitoring%20sysytem.html',
  '/project monitoring sysytem.html',
  '/project-monitoring-system',
  '/project-monitoring-system.html'
], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'project monitoring sysytem.html'));
});

app.get(['/student-login', '/student-login.html'], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'student-login.html'));
});

app.get(['/student-dashboard', '/student-dashboard.html'], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'student-dashboard.html'));
});

app.get(['/teacher-login', '/teacher-login.html'], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'teacher-login.html'));
});

app.get(['/teacher-dashboard', '/teacher-dashboard.html'], (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'teacher-dashboard.html'));
});

// Static assets
app.use(express.static(process.cwd()));

async function initServer() {
  try {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);

    app.listen(PORT, HOST, () => {
      console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
      console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
      console.log(`  ProjectTrack server running on http://${HOST}:${PORT}`);
      console.log(`  REST API ready at http://${HOST}:${PORT}/api/\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

initServer();
