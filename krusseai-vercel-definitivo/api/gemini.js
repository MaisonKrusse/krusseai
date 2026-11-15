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

    // Sistema con múltiples modelos de respaldo automático si uno sufre alta demanda
    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    
    let googleResponse = null;
    let data = null;
    let lastError = '';

    for (const model of modelsToTry) {
      googleResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: contents || [],
            ...(systemInstruction ? { system_instruction: systemInstruction } : {})
          })
        }
      );

      const textData = await googleResponse.text();
      try {
        data = JSON.parse(textData);
      } catch (e) {
        data = { error: { message: textData } };
      }

      if (googleResponse.ok) {
        break;
      } else {
        lastError = data.error?.message || 'Error desconocido';
      }
    }

    if (!googleResponse || !googleResponse.ok) {
      return res.status(500).json({ 
        error: 'Google Gemini Error: ' + lastError 
      });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    return res.status(500).json({ error: 'Error en el servidor proxy: ' + error.message });
  }
}
