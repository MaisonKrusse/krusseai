export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { contents, systemInstruction, model } = req.body;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en las variables de entorno de Vercel.' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de Gemini' });
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo generar una respuesta.';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
