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
              text: `You are an expert geolocation analyst. Analyze this image with extreme precision and identify where it was taken.

Examine every visual clue: landmarks, architecture style, building materials, street signs, vegetation/flora, vehicles (make/model/license plate style), road markings, sky conditions, sun angle/shadows, language on signs, fashion styles, cultural indicators, terrain, waterways.

Respond ONLY in this exact JSON format with no markdown, no backticks, no extra text:
{
  "location": "Specific City, Country",
  "confidence": 85,
  "region": "Specific neighborhood or district if identifiable",
  "reasoning": "Detailed 3-4 sentence explanation of every visual clue used",
  "lat": 35.6762,
  "lng": 139.6503,
  "country": "Japan",
  "city": "Tokyo"
}

Replace lat/lng with your best estimated decimal coordinates. Confidence: 90-100 for GPS/famous landmark, 70-89 for strong visual match, 50-69 for regional match, below 50 for uncertain.`,
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
