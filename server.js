// Storymaps.io — AGPL-3.0 — see LICENCE for details
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 8080;
const DATA_DIR = join(__dirname, 'yjs-data');

// Allowed origins for API writes and WebSocket connections
// localhost is always allowed for development
const ALLOWED_ORIGINS = new Set([
  'https://storymaps.io',
  'https://www.storymaps.io',
  'https://new.storymaps.io',
]);

const isOriginAllowed = (origin) => {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow localhost/127.0.0.1 for development
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

// Set YPERSISTENCE *before* importing y-websocket utils, which reads it at load time
process.env.YPERSISTENCE = DATA_DIR;
const { setupWSConnection, docs } = await import('y-websocket/bin/utils');

// JSON file paths for lock and counter data
const LOCK_FILE = join(DATA_DIR, 'locks.json');
const STATS_FILE = join(DATA_DIR, 'stats.json');

// =============================================================================
// Data Helpers
// =============================================================================

const ensureDataDir = async () => {
  await mkdir(DATA_DIR, { recursive: true });
};

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath, data) => {
  await writeFile(filePath, JSON.stringify(data, null, 2));
};

// =============================================================================
// Static File Config
// =============================================================================

const PUBLIC_DIR = join(__dirname, 'public');
const SRC_DIR = join(__dirname, 'src');
const STATIC_DIRS = [PUBLIC_DIR, SRC_DIR, __dirname];

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Extensions worth gzipping (text-based formats)
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.xml', '.txt']);

// In-memory static file cache: path → { etag, raw, gzipped, contentType, cacheControl }
const fileCache = new Map();

// Cache strategy: no-store for code (browser must always fetch fresh), long cache for assets
const cacheHeader = (ext) => {
  if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2'].includes(ext)) {
    return 'public, max-age=86400'; // Images/fonts: 1 day
  }
  return 'no-store'; // HTML/JS/CSS/JSON: never cache, always fetch fresh
};

// =============================================================================
// REST API Handlers
// =============================================================================

const handleApi = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  // Check origin for write requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && !isOriginAllowed(req.headers.origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  // Parse JSON body for POST/PUT/DELETE (1 MB limit)
  let body = null;
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const MAX_BODY = 1_048_576;
    body = await new Promise((resolve, reject) => {
      let data = '';
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY) { req.destroy(); reject(new Error('Body too large')); return; }
        data += chunk;
      });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({}); }
      });
      req.on('error', reject);
    }).catch(() => null);
    if (body === null && req.destroyed) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body too large' }));
      return;
    }
  }

  // --- Lock API ---
  const lockMatch = path.match(/^\/api\/lock\/([a-z0-9]+)$/);
  if (lockMatch) {
    const mapId = lockMatch[1];
    const locks = await readJson(LOCK_FILE, {});

    if (req.method === 'GET') {
      const lock = locks[mapId] || null;
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(lock));
      return;
    }

    if (req.method === 'POST') {
      locks[mapId] = {
        isLocked: true,
        passwordHash: body.passwordHash,
        lockedAt: Date.now(),
        lockedBy: body.sessionId || null,
      };
      await writeJson(LOCK_FILE, locks);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(locks[mapId]));
      return;
    }

    if (req.method === 'DELETE') {
      delete locks[mapId];
      await writeJson(LOCK_FILE, locks);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  // --- Map ID API ---
  if (path === '/api/maps/new-id' && req.method === 'GET') {
    try {
      const id = generateUniqueMapId();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify({ id }));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to generate unique ID' }));
    }
    return;
  }

  // --- Stats API ---
  if (path === '/api/stats') {
    const stats = await readJson(STATS_FILE, { mapCount: 0 });

    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (req.method === 'POST') {
      stats.mapCount = (stats.mapCount || 0) + 1;
      await writeJson(STATS_FILE, stats);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(stats));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
};

// =============================================================================
// HTTP Server
// =============================================================================

const server = createServer(async (req, res) => {
  try {
  const reqPath = req.url.split('?')[0];

  // API routes
  if (reqPath.startsWith('/api/')) {
    return handleApi(req, res);
  }

  // Static files — try cache first, then disk
  let relPath = reqPath === '/' ? '/index.html' : reqPath;
  const ext = extname(relPath);

  // Resolve cache key: SPA fallback uses '/index.html'
  let cacheKey = relPath;
  let cached = fileCache.get(cacheKey);

  if (!cached) {
    // Try to read from disk (resolve + startsWith guard against path traversal)
    let content;
    for (const dir of STATIC_DIRS) {
      const resolved = resolve(dir, relPath.slice(1)); // strip leading /
      if (!resolved.startsWith(dir + '/') && resolved !== dir) continue;
      try {
        content = await readFile(resolved);
        break;
      } catch {
        // Try next directory
      }
    }

    // SPA fallback: serve index.html for map URLs (no extension, not in subdirectories)
    let isHtmlFallback = false;
    if (!content && !reqPath.includes('/', 1) && (ext === '' || ext === '.json')) {
      cacheKey = '/index.html';
      cached = fileCache.get(cacheKey);
      if (!cached) {
        try {
          content = await readFile(join(PUBLIC_DIR, 'index.html'));
          isHtmlFallback = true;
        } catch {
          // Fall through to 404
        }
      }
    }

    // Build cache entry from disk content
    if (content && !cached) {
      const fileExt = isHtmlFallback ? '.html' : ext;
      const etag = `"${createHash('md5').update(content).digest('hex')}"`;
      cached = {
        etag,
        raw: content,
        gzipped: COMPRESSIBLE.has(fileExt) ? gzipSync(content) : null,
        contentType: isHtmlFallback ? 'text/html' : (MIME_TYPES[ext] || 'application/octet-stream'),
        cacheControl: cacheHeader(fileExt),
      };
      fileCache.set(cacheKey, cached);
    }
  }

  if (cached) {
    if (req.headers['if-none-match'] === cached.etag) {
      res.writeHead(304, { 'Cache-Control': cached.cacheControl });
      res.end();
      return;
    }

    const headers = {
      'Content-Type': cached.contentType,
      'Cache-Control': cached.cacheControl,
      'ETag': cached.etag,
    };

    const acceptGzip = (req.headers['accept-encoding'] || '').includes('gzip');
    if (acceptGzip && cached.gzipped) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      res.end(cached.gzipped);
    } else {
      res.writeHead(200, headers);
      res.end(cached.raw);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
  } catch (err) {
    console.error('Request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

// =============================================================================
// SQLite Map Index
// =============================================================================

const DB_FILE = join(DATA_DIR, 'maps.db');
const sqlite = new Database(DB_FILE);
sqlite.pragma('journal_mode = WAL');
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);

const stmtInsert = sqlite.prepare(
  'INSERT OR IGNORE INTO maps (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
);
const stmtUpdate = sqlite.prepare(
  'UPDATE maps SET name = ?, updated_at = ? WHERE id = ?'
);
const stmtExists = sqlite.prepare('SELECT 1 FROM maps WHERE id = ?');

const generateUniqueMapId = () => {
  for (let i = 0; i < 10; i++) {
    const bytes = randomBytes(6);
    const num = Array.from(bytes).reduce((acc, b) => acc * 256n + BigInt(b), 0n);
    const id = num.toString(36).slice(-8).padStart(8, '0');
    if (!stmtExists.get(id)) return id;
  }
  throw new Error('Failed to generate unique ID');
};

// Debounce map for update writes (mapId → timeout)
const updateTimers = new Map();

const flushMapUpdate = (mapId) => {
  if (!updateTimers.has(mapId)) return;
  clearTimeout(updateTimers.get(mapId));
  updateTimers.delete(mapId);
  try {
    const doc = docs.get(mapId);
    if (doc) {
      const ymap = doc.getMap('storymap');
      const name = ymap.get('name') || 'untitled';
      stmtUpdate.run(name, new Date().toISOString(), mapId);
    }
  } catch (err) {
    console.error(`SQLite flush error for ${mapId}:`, err.message);
  }
};

const trackMapUpdate = (mapId) => {
  if (updateTimers.has(mapId)) clearTimeout(updateTimers.get(mapId));
  updateTimers.set(mapId, setTimeout(() => flushMapUpdate(mapId), 2_000));
};

// Track which docs we've already hooked
const trackedDocs = new Set();

// =============================================================================
// WebSocket Server
// =============================================================================

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  if (!isOriginAllowed(req.headers.origin)) {
    ws.close(4403, 'Forbidden');
    return;
  }
  setupWSConnection(ws, req);

  // Hook into the doc for SQLite tracking
  const docName = (req.url || '').slice(1).split('?')[0];
  const doc = docs.get(docName);
  if (doc && !trackedDocs.has(docName)) {
    trackedDocs.add(docName);

    // Record map creation (INSERT OR IGNORE — won't overwrite migrated data)
    const now = new Date().toISOString();
    stmtInsert.run(docName, 'untitled', now, now);

    // Track updates with debounce
    doc.on('update', () => trackMapUpdate(docName));

    // Flush pending writes when all clients disconnect and doc closes
    doc.on('destroy', () => {
      flushMapUpdate(docName);
      trackedDocs.delete(docName);
    });
  }
});

// =============================================================================
// Start
// =============================================================================

await ensureDataDir();

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});

// Flush pending SQLite writes on shutdown
const gracefulShutdown = () => {
  for (const mapId of updateTimers.keys()) {
    flushMapUpdate(mapId);
  }
  sqlite.close();
  process.exit(0);
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
