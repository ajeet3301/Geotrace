// ============================================================
//  GeoTrace — Geolocation Engine (geo.js)
//  Handles: EXIF parsing, AI vision analysis, reverse geocoding
//  All free: exifr.js + Nominatim + user-supplied Claude key
// ============================================================

// ── Extract EXIF data from image file ────────────────────────
async function extractExif(file) {
  try {
    const exif = await exifr.parse(file, {
      gps: true, tiff: true, exif: true, xmp: true, icc: false
    });
    return {
      latitude:      exif?.latitude  || null,
      longitude:     exif?.longitude || null,
      make:          exif?.Make      || null,
      model:         exif?.Model     || null,
      dateTaken:     exif?.DateTimeOriginal ? new Date(exif.DateTimeOriginal).toISOString() : null,
      focalLength:   exif?.FocalLength ? exif.FocalLength + 'mm' : null,
      aperture:      exif?.FNumber   ? 'f/' + exif.FNumber : null,
      iso:           exif?.ISO       || null,
      exposureTime:  exif?.ExposureTime ? '1/' + Math.round(1/exif.ExposureTime) + 's' : null,
      flash:         exif?.Flash !== undefined ? (exif.Flash ? 'On' : 'Off') : null,
      software:      exif?.Software  || null,
      width:         exif?.ImageWidth || null,
      height:        exif?.ImageHeight|| null,
      orientation:   exif?.Orientation|| null,
      colorSpace:    exif?.ColorSpace || null,
      raw:           exif
    };
  } catch (err) {
    console.warn('EXIF extraction failed:', err);
    return { latitude: null, longitude: null, raw: null };
  }
}

// ── Reverse geocode lat/lon → human address (FREE Nominatim) ──
async function reverseGeocode(lat, lon) {
  try {
    const url = `${APP_CONFIG.nominatimUrl}?lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' }
    });
    const data = await res.json();
    return {
      display:  data.display_name,
      country:  data.address?.country,
      state:    data.address?.state,
      city:     data.address?.city || data.address?.town || data.address?.village,
      postcode: data.address?.postcode,
      road:     data.address?.road
    };
  } catch (err) {
    console.warn('Reverse geocode failed:', err);
    return null;
  }
}

// ── Convert file to base64 ────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Claude Vision AI analysis ─────────────────────────────────
async function analyzeWithAI(file, apiKey, exifData) {
  const base64    = await fileToBase64(file);
  const mediaType = file.type || 'image/jpeg';

  const exifHint = exifData.latitude
    ? `Note: EXIF GPS found at ${exifData.latitude.toFixed(5)}, ${exifData.longitude.toFixed(5)}. Confirm and add visual context.`
    : 'No GPS data in EXIF. Use visual clues only.';

  const prompt = `You are GeoTrace AI, an expert geolocation analyst. Analyze this photo with extreme precision.

${exifHint}

Examine ALL visual evidence:
- Architecture, building materials, window/roof styles, building age
- Vegetation, flora species, climate zone indicators
- Road markings, signs, language, license plates
- Sky conditions, sun angle (indicates latitude/season)
- Geographic terrain: mountains, coast, plains, desert
- Cultural markers: vehicles, clothing, shop styles, infrastructure
- Any identifiable landmarks, monuments, bridges, towers

Return ONLY this JSON (no other text):
{
  "country": "Country name or null",
  "region": "State/Province/Region or null",
  "city": "City name or null",
  "coordinates": {"lat": 0.0, "lon": 0.0},
  "confidence": 85,
  "source": "exif_gps|ai_visual|both",
  "reasoning": "2-3 sentence explanation of key visual clues",
  "landmarks": "Any specific landmarks identified or null",
  "climate": "Climate zone (tropical/temperate/arid/polar)",
  "timeEstimate": "Time of day and approximate season if visible",
  "language": "Language visible in image or null",
  "vehicleTypes": "Vehicle styles noted or null"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':           'application/json',
      'x-api-key':              apiKey,
      'anthropic-version':      '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model:      APP_CONFIG.aiModel,
      max_tokens: APP_CONFIG.maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '{}';

  // Parse JSON response
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── Save search result to Firestore ──────────────────────────
async function saveSearchHistory(uid, fileInfo, exifData, aiResult, geocoded) {
  const record = {
    uid:       uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    fileName:  fileInfo.name,
    fileSize:  fileInfo.size,
    fileType:  fileInfo.type,
    exif: {
      hasGPS:    !!exifData.latitude,
      latitude:  exifData.latitude,
      longitude: exifData.longitude,
      camera:    [exifData.make, exifData.model].filter(Boolean).join(' ') || null,
      dateTaken: exifData.dateTaken
    },
    result: {
      country:    aiResult?.country    || null,
      region:     aiResult?.region     || null,
      city:       aiResult?.city       || null,
      confidence: aiResult?.confidence || null,
      coordinates: aiResult?.coordinates || null,
      source:     aiResult?.source     || null,
      reasoning:  aiResult?.reasoning  || null
    },
    geocoded: geocoded || null
  };

  // Save to searches collection
  const ref = await db.collection('searches').add(record);

  // Increment user search count
  await db.collection('users').doc(uid).update({
    searchCount: firebase.firestore.FieldValue.increment(1),
    lastSearch:  firebase.firestore.FieldValue.serverTimestamp()
  });

  return ref.id;
}

// ── Load user search history from Firestore ───────────────────
async function loadUserHistory(uid, limit = 20) {
  const snap = await db.collection('searches')
    .where('uid', '==', uid)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ── Delete a search record ────────────────────────────────────
async function deleteSearch(searchId) {
  await db.collection('searches').doc(searchId).delete();
}
