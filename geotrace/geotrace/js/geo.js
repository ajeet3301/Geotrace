// geo.js — EXIF Extraction, AI Analysis, Firestore Operations

// Extract EXIF metadata from a file using exifr
async function extractExif(file) {
  try {
    const data = await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      icc: false,
      iptc: false,
      xmp: false
    });

    if (!data) return { hasGPS: false };

    const lat = data.latitude  ?? data.GPSLatitude  ?? null;
    const lon = data.longitude ?? data.GPSLongitude ?? null;

    return {
      hasGPS:       (lat !== null && lon !== null),
      latitude:     lat,
      longitude:    lon,
      make:         data.Make         || null,
      model:        data.Model        || null,
      dateTaken:    data.DateTimeOriginal || data.DateTime || null,
      focalLength:  data.FocalLength  ? `${data.FocalLength}mm` : null,
      aperture:     data.FNumber      ? `f/${data.FNumber}` : null,
      iso:          data.ISO          || null,
      exposureTime: data.ExposureTime ? `${data.ExposureTime}s` : null,
      flash:        data.Flash !== undefined ? (data.Flash ? 'On' : 'Off') : null,
      software:     data.Software     || null,
      width:        data.ExifImageWidth  || data.ImageWidth  || null,
      height:       data.ExifImageHeight || data.ImageHeight || null
    };
  } catch (err) {
    console.warn('EXIF extraction error:', err);
    return { hasGPS: false };
  }
}

// Reverse geocode lat/lon using Nominatim
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'GeoTrace/1.0' }
    });
    const data = await res.json();
    const addr = data.address || {};

    return {
      display:  data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      country:  addr.country     || null,
      state:    addr.state       || addr.county || null,
      city:     addr.city        || addr.town   || addr.village || null,
      postcode: addr.postcode    || null
    };
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    return {
      display:  `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      country:  null,
      state:    null,
      city:     null,
      postcode: null
    };
  }
}

// Convert a File object to base64 string
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Build the geolocation prompt for Claude
function buildPrompt(exifData) {
  let exifHint = '';
  if (exifData && exifData.hasGPS && exifData.latitude && exifData.longitude) {
    exifHint = `\n\nNOTE: EXIF GPS data found — Lat: ${exifData.latitude.toFixed(6)}, Lon: ${exifData.longitude.toFixed(6)}. Use these coordinates as ground truth and set source to "exif_gps".`;
  }

  return `You are an expert AI geolocation analyst with decades of experience identifying locations from photographs. Analyze this image carefully and determine exactly where it was taken.

Examine ALL visual clues including:
- Architecture and building styles (materials, construction era, design motifs)
- Vegetation, flora, and landscape features
- Road signs, street signs, and text visible in the image
- Language of any written text
- License plates and vehicle types/makes
- Sky conditions, sun angle, and seasonal indicators
- Geographic terrain and topography
- Cultural markers, clothing, and people
- Infrastructure (power lines, street furniture, road markings)
- Unique landmarks, monuments, or distinctive features${exifHint}

Respond with ONLY valid JSON and absolutely nothing else — no markdown, no explanation, no code block:
{
  "country": "country name or null",
  "region": "state/province/region or null",
  "city": "city or town name or null",
  "coordinates": { "lat": 0.0, "lon": 0.0 },
  "confidence": 75,
  "source": "ai_visual",
  "reasoning": "2-3 sentences explaining the visual evidence used",
  "landmarks": "specific landmarks identified or null",
  "climate": "climate type and current season estimate",
  "timeEstimate": "estimated time of day or null",
  "language": "language visible in image or null",
  "vehicleTypes": "vehicle types/makes visible or null"
}

The "source" field must be one of: "exif_gps", "ai_visual", or "both".
The "confidence" field is a number 0-100 representing your certainty.
If you cannot determine a value, use null.`;
}

// Call Claude Vision API for geolocation analysis
async function analyzeWithAI(file, apiKey, exifData = {}) {
  const base64 = await fileToBase64(file);
  const mediaType = file.type || 'image/jpeg';
  const prompt = buildPrompt(exifData);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.find(c => c.type === 'text')?.text || '{}';

  // Clean and parse JSON
  let parsed;
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse AI response as JSON');
  }

  return {
    country:      parsed.country      || null,
    region:       parsed.region       || null,
    city:         parsed.city         || null,
    coordinates:  parsed.coordinates  || { lat: null, lon: null },
    confidence:   parsed.confidence   || 0,
    source:       parsed.source       || 'ai_visual',
    reasoning:    parsed.reasoning    || 'No reasoning provided',
    landmarks:    parsed.landmarks    || null,
    climate:      parsed.climate      || null,
    timeEstimate: parsed.timeEstimate || null,
    language:     parsed.language     || null,
    vehicleTypes: parsed.vehicleTypes || null
  };
}

// Save search to Firestore and increment user count
async function saveSearchHistory(uid, fileInfo, exifData, aiResult, geocoded) {
  const db = GeoAuth.getDb();

  const searchData = {
    uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    fileName:  fileInfo.name,
    fileSize:  fileInfo.size,
    fileType:  fileInfo.type,
    exif: {
      hasGPS:    exifData.hasGPS    || false,
      latitude:  exifData.latitude  || null,
      longitude: exifData.longitude || null,
      camera:    exifData.make && exifData.model ? `${exifData.make} ${exifData.model}` : null,
      dateTaken: exifData.dateTaken || null
    },
    result: {
      country:    aiResult.country    || null,
      region:     aiResult.region     || null,
      city:       aiResult.city       || null,
      confidence: aiResult.confidence || 0,
      coordinates: aiResult.coordinates || { lat: null, lon: null },
      source:     aiResult.source     || 'ai_visual',
      reasoning:  aiResult.reasoning  || ''
    },
    geocoded: geocoded || {}
  };

  const docRef = await db.collection('searches').add(searchData);

  // Increment user's search count
  await db.collection('users').doc(uid).update({
    searchCount: firebase.firestore.FieldValue.increment(1),
    lastSearch:  firebase.firestore.FieldValue.serverTimestamp()
  });

  return docRef.id;
}

// Load user's search history
async function loadUserHistory(uid, limit = 50) {
  const db = GeoAuth.getDb();
  const snap = await db.collection('searches')
    .where('uid', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Delete a search record
async function deleteSearch(searchId) {
  const db = GeoAuth.getDb();
  await db.collection('searches').doc(searchId).delete();
}

// Expose globals
window.GeoEngine = {
  extractExif,
  reverseGeocode,
  fileToBase64,
  analyzeWithAI,
  saveSearchHistory,
  loadUserHistory,
  deleteSearch
};
