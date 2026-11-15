export default async function handler(req, res) {
  // Configurar cabeceras CORS por seguridad
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
    // Asegurar que req.body se lee correctamente tanto si es objeto como string
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }

    const { contents, systemInstruction, model } = body || {};
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta configurar la variable GEMINI_API_KEY en las Environment Variables de Vercel.' });
    }

    // Usar gemini-1.5-flash como modelo base estable y seguro
    const selectedModel = model || 'gemini-1.5-flash';

    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: contents || [],
          systemInstruction: systemInstruction || undefined
        })
      }
    );

    const data = await googleResponse.json();

    if (!googleResponse.ok) {
      const errorMsg = data.error?.message || 'Error devuelto por la API de Google Gemini';
      return res.status(googleResponse.status).json({ error: errorMsg });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    return res.status(500).json({ error: 'Excepción en el servidor proxy: ' + error.message });
  }
}
