/**
 * GeoTrace Live — Real-Time Location Server
 * Express + WebSocket + JWT + Geofencing + Analytics
 */

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const cors       = require('cors');
const path       = require('path');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// ─── CONFIG ──────────────────────────────────────────────
const JWT_SECRET  = process.env.JWT_SECRET  || 'geotrace_secret_change_me_in_prod';
const PORT        = process.env.PORT        || 3001;
const MAX_HISTORY = 500; // max points per user

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── IN-MEMORY STORE (replace with DB in production) ─────
const users     = new Map(); // id → { id, name, email, passwordHash, color, role }
const locations = new Map(); // userId → [{ lat, lon, ts, speed, heading, accuracy }]
const geofences = new Map(); // fenceId → { id, name, lat, lon, radius, ownerId, alertOn }
const sessions  = new Map(); // userId → socketId[]
const heatmap   = new Map(); // userId → [{ lat, lon, weight }]

// ─── DEMO USER ────────────────────────────────────────────
const demoId = 'demo-user-1';
users.set(demoId, {
  id:           demoId,
  name:         'Demo User',
  email:        'demo@geotrace.io',
  passwordHash: bcrypt.hashSync('demo123', 8),
  color:        '#7c3aed',
  role:         'user',
  createdAt:    Date.now()
});
locations.set(demoId, []);

// ─── AUTH HELPERS ─────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ error: 'No token' });
  try {
    req.userId = jwt.verify(t, JWT_SECRET).userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─── AUTH ROUTES ──────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Missing fields' });

  for (const u of users.values())
    if (u.email === email) return res.status(400).json({ error: 'Email taken' });

  const id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  const colors = ['#7c3aed','#06b6d4','#e879f9','#fbbf24','#10b981','#ef4444'];
  const color  = colors[users.size % colors.length];

  users.set(id, {
    id, name, email,
    passwordHash: await bcrypt.hash(password, 8),
    color, role: 'user',
    createdAt: Date.now()
  });
  locations.set(id, []);

  res.json({ token: signToken(id), user: { id, name, email, color, role:'user' } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  let found = null;
  for (const u of users.values()) if (u.email === email) { found = u; break; }
  if (!found) return res.status(400).json({ error: 'User not found' });

  const ok = await bcrypt.compare(password, found.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Wrong password' });

  const { passwordHash, ...safe } = found;
  res.json({ token: signToken(found.id), user: safe });
});

// ─── LOCATION ROUTES ──────────────────────────────────────
app.get('/api/location/history', verifyToken, (req, res) => {
  const hist = locations.get(req.userId) || [];
  res.json({ points: hist.slice(-500) });
});

app.delete('/api/location/history', verifyToken, (req, res) => {
  locations.set(req.userId, []);
  heatmap.set(req.userId, []);
  res.json({ ok: true });
});

app.get('/api/location/heatmap', verifyToken, (req, res) => {
  const pts = heatmap.get(req.userId) || [];
  res.json({ points: pts });
});

// ─── ANALYTICS ROUTE ──────────────────────────────────────
app.get('/api/analytics', verifyToken, (req, res) => {
  const hist = locations.get(req.userId) || [];
  if (hist.length < 2) return res.json({ distance:0, duration:0, avgSpeed:0, maxSpeed:0, points:hist.length });

  let dist = 0, maxSpeed = 0;
  for (let i = 1; i < hist.length; i++) {
    dist     += haversine(hist[i-1], hist[i]);
    maxSpeed  = Math.max(maxSpeed, hist[i].speed || 0);
  }
  const duration = hist[hist.length-1].ts - hist[0].ts; // ms
  const avgSpeed = duration > 0 ? (dist / (duration / 3600000)) : 0;

  res.json({
    distance:  Math.round(dist * 100) / 100, // km
    duration:  Math.round(duration / 60000),  // min
    avgSpeed:  Math.round(avgSpeed * 10) / 10,
    maxSpeed:  Math.round(maxSpeed * 10) / 10,
    points:    hist.length,
    startTime: hist[0].ts,
    endTime:   hist[hist.length-1].ts
  });
});

// ─── GEOFENCE ROUTES ──────────────────────────────────────
app.get('/api/geofences', verifyToken, (req, res) => {
  const fences = [];
  for (const f of geofences.values())
    if (f.ownerId === req.userId) fences.push(f);
  res.json({ fences });
});

app.post('/api/geofences', verifyToken, (req, res) => {
  const { name, lat, lon, radius, alertOn = 'both' } = req.body;
  if (!name || lat == null || lon == null || !radius)
    return res.status(400).json({ error: 'Missing fields' });

  const id = 'gf_' + Date.now();
  const fence = { id, name, lat, lon, radius, alertOn, ownerId: req.userId, createdAt: Date.now() };
  geofences.set(id, fence);
  res.json({ fence });
});

app.delete('/api/geofences/:id', verifyToken, (req, res) => {
  const f = geofences.get(req.params.id);
  if (!f || f.ownerId !== req.userId) return res.status(404).json({ error: 'Not found' });
  geofences.delete(req.params.id);
  res.json({ ok: true });
});

// ─── USERS ONLINE LIST ────────────────────────────────────
app.get('/api/users/online', verifyToken, (req, res) => {
  const list = [];
  for (const [uid, sids] of sessions.entries()) {
    if (sids.size > 0) {
      const u = users.get(uid);
      if (u) {
        const hist = locations.get(uid) || [];
        const last = hist[hist.length-1] || null;
        list.push({ id: u.id, name: u.name, color: u.color, lastLocation: last });
      }
    }
  }
  res.json({ users: list });
});

// ─── WEBSOCKET ────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.userId = jwt.verify(token, JWT_SECRET).userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Track per-user fence state (in/out) to fire edge events only
const fenceState = new Map(); // `${userId}:${fenceId}` → true (inside)

io.on('connection', socket => {
  const uid  = socket.userId;
  const user = users.get(uid);
  if (!user) return socket.disconnect();

  // Add to sessions
  if (!sessions.has(uid)) sessions.set(uid, new Set());
  sessions.get(uid).add(socket.id);

  console.log(`[WS] ${user.name} connected (${socket.id})`);

  // Broadcast user joined
  socket.broadcast.emit('user:joined', { id: uid, name: user.name, color: user.color });

  // ── LOCATION UPDATE ──────────────────────────
  socket.on('location:update', (data) => {
    const { lat, lon, accuracy = 0, speed = 0, heading = 0 } = data;
    if (lat == null || lon == null) return;

    const point = { lat, lon, accuracy, speed, heading, ts: Date.now(), userId: uid };

    // Store in history
    const hist = locations.get(uid) || [];
    hist.push(point);
    if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY);
    locations.set(uid, hist);

    // Heatmap aggregation (cluster nearby points)
    updateHeatmap(uid, lat, lon);

    // Broadcast to all connected clients (multi-user tracking)
    io.emit('location:broadcast', {
      userId:  uid,
      name:    user.name,
      color:   user.color,
      lat, lon, accuracy, speed, heading,
      ts:      point.ts
    });

    // Geofence check
    checkGeofences(socket, uid, user, lat, lon);
  });

  // ── ROUTE PLAYBACK REQUEST ───────────────────
  socket.on('route:request', () => {
    const hist = locations.get(uid) || [];
    socket.emit('route:data', { points: hist });
  });

  // ── DISCONNECT ───────────────────────────────
  socket.on('disconnect', () => {
    sessions.get(uid)?.delete(socket.id);
    if (sessions.get(uid)?.size === 0) {
      io.emit('user:left', { id: uid, name: user.name });
    }
    console.log(`[WS] ${user.name} disconnected`);
  });
});

// ─── GEOFENCE CHECK ───────────────────────────────────────
function checkGeofences(socket, userId, user, lat, lon) {
  for (const fence of geofences.values()) {
    if (fence.ownerId !== userId) continue;

    const dist     = haversine({ lat, lon }, { lat: fence.lat, lon: fence.lon }) * 1000; // meters
    const key      = `${userId}:${fence.id}`;
    const wasInside = fenceState.get(key) || false;
    const isInside  = dist <= fence.radius;

    if (isInside && !wasInside && (fence.alertOn === 'enter' || fence.alertOn === 'both')) {
      fenceState.set(key, true);
      const alert = { type: 'enter', fenceName: fence.name, fenceId: fence.id, userId, userName: user.name, ts: Date.now() };
      socket.emit('geofence:alert', alert);
      io.emit('geofence:event', alert);
    } else if (!isInside && wasInside && (fence.alertOn === 'exit' || fence.alertOn === 'both')) {
      fenceState.set(key, false);
      const alert = { type: 'exit', fenceName: fence.name, fenceId: fence.id, userId, userName: user.name, ts: Date.now() };
      socket.emit('geofence:alert', alert);
      io.emit('geofence:event', alert);
    } else {
      fenceState.set(key, isInside);
    }
  }
}

// ─── HEATMAP UPDATE ───────────────────────────────────────
function updateHeatmap(userId, lat, lon) {
  const pts  = heatmap.get(userId) || [];
  const CELL = 0.0005; // ~55m grid
  const key  = `${Math.round(lat/CELL)*CELL},${Math.round(lon/CELL)*CELL}`;

  const existing = pts.find(p => `${Math.round(p.lat/CELL)*CELL},${Math.round(p.lon/CELL)*CELL}` === key);
  if (existing) { existing.weight = Math.min(existing.weight + 1, 100); }
  else          { pts.push({ lat, lon, weight: 1 }); }

  if (pts.length > 2000) pts.splice(0, pts.length - 2000);
  heatmap.set(userId, pts);
}

// ─── HAVERSINE ────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
}

// ─── SPA FALLBACK ─────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
  console.log(`\n🌍 GeoTrace Live running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🔑 Demo login: demo@geotrace.io / demo123\n`);
});
