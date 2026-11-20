// Endpoint serverless en Vercel: /api/gemini
// Recibe { model, priority, systemPrompt, messages, image } desde index.html
// y devuelve { text } usando por defecto el modelo más rápido y gratuito (gemini-2.5-flash-lite).

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.8-flash',
  'gemini-3.8-pro'
]);

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';

// Usa siempre gemini-2.5-flash-lite por defecto (el más rápido y con mayor cuota gratuita)
// salvo que configures GEMINI_MODEL_FLASH o GEMINI_MODEL_PRO en Vercel.
function resolveModel(requestedModel) {
  if (!requestedModel || typeof requestedModel !== 'string') return DEFAULT_MODEL;
  if (requestedModel === 'gemini-3.8-pro') {
    return process.env.GEMINI_MODEL_PRO || DEFAULT_MODEL;
  }
  if (requestedModel === 'gemini-3.8-flash') {
    return process.env.GEMINI_MODEL_FLASH || DEFAULT_MODEL;
  }
  return ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

    // Convertir el formato [{ role: 'user'|'assistant', content }] al formato de Gemini
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

    // Si el último mensaje del usuario lleva imagen adjunta (data URL), añadirla a sus parts
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
