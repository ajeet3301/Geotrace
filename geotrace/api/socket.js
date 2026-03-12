// GeoTrace Live — api/socket.js
// Vercel-compatible REST polling (no persistent WebSocket)
const store = global._gt || (global._gt = {
  locations: {}, heatmap: {}, geofences: {}, online: {}
});

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-user-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.url || '').replace(/^\/api\/socket/, '').split('?')[0];
  const uid  = req.body?.userId || req.query?.userId || req.headers['x-user-id'] || '';

  // GET /ping
  if (req.method === 'GET' && path === '/ping')
    return res.json({ ok: true, ts: Date.now() });

  // POST /location  — push a GPS point
  if (req.method === 'POST' && path === '/location') {
    const { userId, name, color, lat, lon, speed = 0, heading = 0, accuracy = 0 } = req.body || {};
    if (!userId || lat == null) return res.status(400).json({ error: 'Missing fields' });
    if (!store.locations[userId]) store.locations[userId] = [];
    const pt = { lat, lon, speed, heading, accuracy, ts: Date.now() };
    store.locations[userId].push(pt);
    if (store.locations[userId].length > 500) store.locations[userId].shift();
    store.online[userId] = { name: name || userId, color: color || '#7c3aed', lastSeen: Date.now(), lastLocation: pt };
    updateHeatmap(userId, lat, lon);
    return res.json({ ok: true, alerts: checkFences(userId, lat, lon) });
  }

  // GET /location/history
  if (req.method === 'GET' && path === '/location/history')
    return res.json({ points: (store.locations[uid] || []).slice(-500) });

  // DELETE /location/history
  if (req.method === 'DELETE' && path === '/location/history') {
    store.locations[uid] = []; store.heatmap[uid] = [];
    return res.json({ ok: true });
  }

  // GET /location/live — all users active in last 30s
  if (req.method === 'GET' && path === '/location/live') {
    const cut = Date.now() - 30000;
    return res.json({ users: Object.values(store.online).filter(u => u.lastSeen > cut) });
  }

  // GET /heatmap
  if (req.method === 'GET' && path === '/heatmap')
    return res.json({ points: store.heatmap[uid] || [] });

  // GET /analytics
  if (req.method === 'GET' && path === '/analytics') {
    const pts = store.locations[uid] || [];
    if (pts.length < 2) return res.json({ distance: 0, duration: 0, avgSpeed: 0, maxSpeed: 0, points: 0 });
    let dist = 0, maxSpeed = 0;
    for (let i = 1; i < pts.length; i++) {
      dist += haversine(pts[i - 1], pts[i]);
      maxSpeed = Math.max(maxSpeed, pts[i].speed || 0);
    }
    const dur = pts[pts.length - 1].ts - pts[0].ts;
    return res.json({
      distance:  +dist.toFixed(2),
      duration:  Math.round(dur / 60000),
      avgSpeed:  +(dist / (dur / 3600000)).toFixed(1),
      maxSpeed:  +maxSpeed.toFixed(1),
      points:    pts.length,
      startTime: pts[0].ts,
      endTime:   pts[pts.length - 1].ts
    });
  }

  // GET /geofences
  if (req.method === 'GET' && path === '/geofences')
    return res.json({ fences: Object.values(store.geofences).filter(f => f.ownerId === uid) });

  // POST /geofences
  if (req.method === 'POST' && path === '/geofences') {
    const { userId, name, lat, lon, radius, alertOn = 'both' } = req.body || {};
    if (!userId || !name || lat == null || !radius) return res.status(400).json({ error: 'Missing fields' });
    const id = 'gf_' + Date.now();
    store.geofences[id] = { id, name, lat, lon, radius, alertOn, ownerId: userId, createdAt: Date.now() };
    return res.json({ fence: store.geofences[id] });
  }

  // DELETE /geofences/:id
  if (req.method === 'DELETE' && path.startsWith('/geofences/')) {
    delete store.geofences[path.split('/')[2]];
    return res.json({ ok: true });
  }

  return res.status(404).json({ error: 'Not found' });
}

function haversine(a, b) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d, dLon = (b.lon - a.lon) * d;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function updateHeatmap(uid, lat, lon) {
  if (!store.heatmap[uid]) store.heatmap[uid] = [];
  const C = 0.0005;
  const key = `${Math.round(lat / C) * C},${Math.round(lon / C) * C}`;
  const ex  = store.heatmap[uid].find(p => `${Math.round(p.lat / C) * C},${Math.round(p.lon / C) * C}` === key);
  ex ? (ex.weight = Math.min(ex.weight + 1, 100)) : store.heatmap[uid].push({ lat, lon, weight: 1 });
  if (store.heatmap[uid].length > 2000) store.heatmap[uid].splice(0, store.heatmap[uid].length - 2000);
}

const fenceState = {};
function checkFences(uid, lat, lon) {
  return Object.values(store.geofences).filter(f => f.ownerId === uid).reduce((acc, f) => {
    const dist = haversine({ lat, lon }, { lat: f.lat, lon: f.lon }) * 1000;
    const key  = `${uid}:${f.id}`;
    const was  = fenceState[key] || false;
    const is   = dist <= f.radius;
    if (is && !was && (f.alertOn === 'enter' || f.alertOn === 'both'))  { fenceState[key] = true;  acc.push({ type: 'enter', fenceName: f.name, fenceId: f.id }); }
    else if (!is && was && (f.alertOn === 'exit' || f.alertOn === 'both')) { fenceState[key] = false; acc.push({ type: 'exit',  fenceName: f.name, fenceId: f.id }); }
    else fenceState[key] = is;
    return acc;
  }, []);
}
