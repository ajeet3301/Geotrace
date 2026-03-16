/* ================================================================
   GEOTRACE — api/analyze.js
   Vercel Serverless Function — proxies Claude API calls
   This keeps your Anthropic API key safe from browser CORS issues.

   The API key is passed per-request from the user's browser session.
   It is NEVER stored on the server.
   ================================================================ */

export default async function handler(req, res) {
  // CORS headers — allow only your own domain in production
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mediaType, apiKey } = req.body;

    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return res.status(400).json({ error: 'Invalid Anthropic API key' });
    }

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const payload = {
      model:      'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type:   'image',
              source: {
                type:       'base64',
                media_type: mediaType || 'image/jpeg',
                data:       imageBase64,
              },
            },
            {
              type: 'text',
              text: `You are a geolocation expert. Analyze this image and determine where it was taken.

Look for:
- Landmarks, monuments, famous buildings
- Street signs, license plates, text in any language
- Architectural style and building materials
- Vegetation, terrain, climate indicators
- Traffic, road markings, vehicle types
- Cultural markers, clothing, signage style

Respond in exactly this JSON format (no markdown, raw JSON only):
{
  "location": "City, Country",
  "confidence": 85,
  "region": "Specific neighborhood or area if known",
  "reasoning": "2-3 sentences explaining visual clues",
  "lat": null_or_decimal,
  "lng": null_or_decimal
}

If you cannot determine the location at all, set confidence to 0 and location to "Unknown".`,
            },
          ],
        },
      ],
    };

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: data.error?.message || 'Anthropic API error',
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('analyze API error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
