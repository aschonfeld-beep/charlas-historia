/**
 * API REST (Grupo B, backend) — función serverless para Vercel.
 * POST /api  con {"prompt":"..."} (JSON) o prompt=... (form)  ->  texto de la respuesta.
 * La clave va en la variable de entorno GROQ_API_KEY (Vercel > Settings > Environment Variables).
 */
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-20b';
const MAX_PROMPT = 4000;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  const fin = (code, msg) => res.status(code).send(msg);

  if (req.method === 'OPTIONS') return fin(204, '');
  if (req.method !== 'POST') return fin(405, 'Usar POST con el parametro prompt.');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) return fin(400, 'Falta el parametro prompt.');
  if (prompt.length > MAX_PROMPT) return fin(413, `El prompt supera los ${MAX_PROMPT} caracteres.`);

  const clave = process.env.GROQ_API_KEY;
  if (!clave) return fin(500, 'El servidor no tiene configurada la clave de Groq.');

  try {
    const r = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clave}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        reasoning_effort: 'low',
        max_completion_tokens: 1024,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return fin(502, `Error de Groq (${r.status}): ${data.error?.message || 'desconocido'}`);
    const texto = (data.choices?.[0]?.message?.content || '').trim();
    if (!texto) return fin(502, 'El modelo devolvio una respuesta vacia.');
    return fin(200, texto);
  } catch (e) {
    return fin(502, 'No se pudo contactar a Groq: ' + e.message);
  }
};
