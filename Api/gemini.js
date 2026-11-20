// Endpoint serverless en Vercel: /api/gemini
// Recibe { model, priority, systemPrompt, messages, image } desde index.html
// y devuelve { text } usando la API de Gemini.

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-3.6-flash',
  'gemini-3.6-pro',
  'gemini-3.8-flash',
  'gemini-3.8-pro'
]);

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

function resolveModel(requestedModel) {
  if (!requestedModel || typeof requestedModel !== 'string') return DEFAULT_MODEL;
  const clean = requestedModel.trim();
  if (clean.includes('pro')) {
    return process.env.GEMINI_MODEL_PRO || DEFAULT_MODEL;
  }
  if (clean.includes('flash')) {
    return process.env.GEMINI_MODEL_FLASH || DEFAULT_MODEL;
  }
  return ALLOWED_MODELS.has(clean) ? clean : DEFAULT_MODEL;
}

function parseDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    inlineData: {
      mimeType: match[1],
      data: match[2]
    }
  };
}

export default async function handler(req, res) {
  // Permite comprobar desde el navegador si la ruta existe
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'El endpoint /api/gemini esta activo y listo para recibir POST.',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY)
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { model, systemPrompt, messages, image } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'El historial de mensajes está vacío.' });
    }

    const contents = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    if (!contents.length) {
      return res.status(400).json({ error: 'No hay mensajes válidos para procesar.' });
    }

    const imagePart = parseDataUrlImage(image);
    if (imagePart) {
      const lastMsg = contents[contents.length - 1];
      if (lastMsg.role === 'user') {
        lastMsg.parts.push(imagePart);
      }
    }

    const resolvedModel = resolveModel(model);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolvedModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt.trim() }]
      };
    }

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await geminiRes.json().catch(() => ({}));

    if (!geminiRes.ok) {
      console.error('Gemini API error:', geminiRes.status, data);
      return res.status(geminiRes.status).json({
        error: 'Error al consultar la API de Gemini.',
        details: data.error ? data.error.message : 'Error desconocido'
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('').trim();

    if (!text) {
      return res.status(502).json({
        error: 'Gemini no devolvió texto en la respuesta.'
      });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Handler /api/gemini error:', err);
    return res.status(500).json({
      error: 'Error interno en el servidor al procesar la consulta.',
      message: err instanceof Error ? err.message : 'Error desconocido'
    });
  }
}
