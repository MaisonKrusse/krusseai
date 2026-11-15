export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      try {
        if (typeof body === 'string') {
          body = JSON.parse(body);
        } else {
          body = await new Promise((resolve) => {
            let data = '';
            req.on('data', chunk => { data += chunk; });
            req.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
            });
          });
        }
      } catch (e) {
        body = {};
      }
    }

    const { contents, systemInstruction } = body || {};
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta configurar la variable GEMINI_API_KEY en Vercel.' });
    }

    // Llamada directa y rápida sin bucles para evitar bloqueos en Vercel
    const selectedModel = 'gemini-3.8-flash';

    const googlePayload = {
      contents: contents || []
    };

    if (systemInstruction) {
      googlePayload.system_instruction = systemInstruction;
    }

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googlePayload)
      }
    );

    const textData = await googleResponse.text();
    let data;
    try {
      data = JSON.parse(textData);
    } catch (e) {
      return res.status(500).json({ error: 'Respuesta inválida de Google (no es JSON): ' + textData.slice(0, 150) });
    }

    if (!googleResponse.ok) {
      return res.status(googleResponse.status).json({ 
        error: data.error?.message || 'Error devuelto por la API de Google Gemini' 
      });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    return res.status(500).json({ error: 'Error en el servidor proxy: ' + error.message });
  }
}

