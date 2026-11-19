# KrusseAI — Despliegue en Vercel (sin tocar index.html)

Este paquete incluye la configuración y el endpoint de verificación para Vercel sin modificar tu `index.html`:

- `vercel.json`: configuración base para Vercel.
- `package.json`: metadatos del proyecto.
- `api/verify-email.js`: función serverless que lee la clave API desde `process.env.EMAIL_VERIFICATION_API_KEY` en el servidor.

## Pasos en Vercel
1. Sube estos archivos a tu repositorio en GitHub manteniendo intacto tu `index.html` actual.
2. Importa el repositorio en Vercel y pulsa **Deploy**.
3. En Vercel, ve a **Settings → Environment Variables** y crea `EMAIL_VERIFICATION_API_KEY` con tu clave de verificación de correo.
4. Haz **Redeploy** si añadiste la variable después del primer despliegue.
