const GT_Geo = (() => {

  async function extractExif(file) {
    try {
      const data = await exifr.parse(file, {
        gps: true, tiff: true, exif: true, iptc: false, icc: false, xmp: false
      });
      return data || {};
    } catch { return {}; }
  }

  function getGpsFromExif(exif) {
    if (exif?.latitude != null && exif?.longitude != null)
      return { lat: exif.latitude, lon: exif.longitude };
    return null;
  }

  async function analyzeWithClaude(file, apiKey) {
    const b64 = await fileToBase64(file);
    const mediaType = file.type || 'image/jpeg';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: window.APP_CONFIG?.anthropicModel || 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
            { type: 'text', text: `Analyze this photo and identify the most likely geographic location where it was taken.

Examine: landmarks, architecture style, vegetation, language/text, vehicles, street signs, sky/lighting, cultural indicators.

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
  "location": "City, Country",
  "latitude": 35.6762,
  "longitude": 139.6503,
  "confidence": 88,
  "reasoning": "Brief explanation of visual clues used",
  "country": "Japan",
  "city": "Tokyo"
}` }
          ]
        }]
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API error ${resp.status}`);
    }
    const data = await resp.json();
    const text = data.content?.[0]?.text || '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }

  async function reverseGeocode(lat, lon) {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await resp.json();
      return data.display_name || null;
    } catch { return null; }
  }

  async function saveSearch(db, userId, payload) {
    if (!db || !userId) return null;
    const doc = {
      userId,
      ...payload,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = await db.collection('searches').add(doc);
    return ref.id;
  }

  async function getHistory(db, userId, limit = 50) {
    if (!db || !userId) return [];
    const snap = await db.collection('searches')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('FileReader failed'));
      r.readAsDataURL(file);
    });
  }

  function formatExifForDisplay(exif) {
    const keys = {
      Make:'Camera Make', Model:'Camera Model',
      DateTime:'Date Taken', ExposureTime:'Exposure',
      FNumber:'Aperture', ISO:'ISO',
      FocalLength:'Focal Length', Flash:'Flash',
      ImageWidth:'Width', ImageHeight:'Height',
      Software:'Software', latitude:'Latitude',
      longitude:'Longitude', altitude:'Altitude'
    };
    const rows = [];
    for (const [k, label] of Object.entries(keys)) {
      if (exif[k] != null) {
        let val = exif[k];
        if (k === 'FNumber')     val = 'f/' + val;
        if (k === 'ExposureTime') val = (val < 1 ? '1/' + Math.round(1/val) : val) + 's';
        if (k === 'FocalLength')  val = val + 'mm';
        if (k === 'altitude')     val = val.toFixed(1) + 'm';
        if (typeof val === 'number' && (k==='latitude'||k==='longitude')) val = val.toFixed(6);
        rows.push({ label, value: String(val) });
      }
    }
    return rows;
  }

  return { extractExif, getGpsFromExif, analyzeWithClaude, reverseGeocode, saveSearch, getHistory, formatExifForDisplay };
})();
