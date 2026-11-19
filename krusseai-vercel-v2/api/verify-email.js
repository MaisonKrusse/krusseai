// Endpoint serverless en Vercel: /api/verify-email
// Usa una variable de entorno configurada en Vercel (nunca escribas la clave real en el código).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const apiKey = process.env.EMAIL_VERIFICATION_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Falta configurar EMAIL_VERIFICATION_API_KEY en las variables de entorno de Vercel.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = (body.email || '').trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Proporciona un correo electrónico válido.' });
    }

    // Sustituye la URL y el formato según el proveedor de verificación de correo que utilices.
    const providerResponse = await fetch('https://api.example-email-verifier.com/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ email })
    });

    const data = await providerResponse.json().catch(() => ({}));

    if (!providerResponse.ok) {
      return res.status(providerResponse.status).json({
        error: 'Error al verificar el correo con el proveedor externo.',
        details: data
      });
    }

    return res.status(200).json({
      ok: true,
      email,
      verification: data
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Error interno al procesar la verificación de correo.',
      message: err instanceof Error ? err.message : 'Error desconocido'
    });
  }
}
