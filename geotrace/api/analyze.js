/* ================================================================
   GEOTRACE — api/analyze.js
   Vercel serverless — Claude AI proxy
   API key from ANTHROPIC_API_KEY env var, never from client
   ================================================================ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, mediaType } = req.body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type:   'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
            },
            {
              type: 'text',
              text: `You are a geolocation expert. Analyze this image and determine where it was taken.

Look for landmarks, architecture, street signs, vegetation, vehicles, cultural markers.

Respond ONLY in this exact JSON format with no markdown or extra text:
{
  "location": "City, Country",
  "confidence": 85,
  "region": "Specific area if known",
  "reasoning": "2-3 sentences explaining visual clues",
  "lat": null,
  "lng": null
}

Replace lat/lng with decimal numbers if you can estimate coordinates. If unknown, use null.`,
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Claude API error' });
    return res.status(200).json(data);

  } catch (err) {
    console.error('analyze error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
