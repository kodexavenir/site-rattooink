function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown');
}

const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 6;

function isRateLimited(ip) {
  const now = Date.now();
  const current = buckets.get(ip);

  if (!current || current.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) return true;

  current.count += 1;
  return false;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Le corps de la requête doit être en JSON.' });
  }

  const origin = String(req.headers.origin || '').trim();
  const configuredOrigin = String(process.env.APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (configuredOrigin && origin && origin !== configuredOrigin) {
    return res.status(403).json({ error: 'Origine non autorisée.' });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Trop de générations. Réessayez dans une minute.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY manquante sur Vercel.');
    return res.status(500).json({ error: 'Le service IA est momentanément indisponible.' });
  }

  try {
    const body = parseBody(req);
    const userPrompt = String(body.prompt || '').trim();

    if (!userPrompt) {
      return res.status(400).json({ error: 'Décris ton projet de tatouage.' });
    }

    if (userPrompt.length < 3) {
      return res.status(400).json({ error: 'Décris un peu plus ton idée.' });
    }

    if (userPrompt.length > 1500) {
      return res.status(400).json({ error: 'Description trop longue. Limite : 1500 caractères.' });
    }

    const prompt = [
      'Tu es l’outil de conception visuelle officiel de RattooInk.',
      'Génère un concept de tatouage original à partir de la demande du client.',
      'Le rendu doit être pensé comme une planche de concept professionnelle, nette, lisible et exploitable par une tatoueuse.',
      'Privilégie un fond blanc ou neutre, une composition claire, un dessin propre et un contraste élevé.',
      'Ne montre pas de corps humain tatoué, sauf si le client demande explicitement une simulation de placement.',
      'N’ajoute ni logo, ni watermark, ni signature, ni texte parasite.',
      'Respecte fidèlement le sujet, le style, les éléments et les couleurs demandées par le client.',
      `Demande du client : ${userPrompt}`
    ].join('\n\n');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-image',
          input: prompt
        }),
        signal: controller.signal
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Gemini API error', {
          status: response.status,
          message: data?.error?.message || 'unknown'
        });
        return res.status(502).json({ error: 'Le moteur IA n’a pas pu générer cette création.' });
      }

      let image = data?.output_image;

      if (!image && Array.isArray(data?.steps)) {
        for (const step of data.steps) {
          for (const block of step?.content || []) {
            if (block?.type === 'image' && block?.data) {
              image = block;
              break;
            }
          }
          if (image) break;
        }
      }

      if (!image?.data) {
        return res.status(502).json({ error: 'Le moteur IA a répondu sans image exploitable.' });
      }

      const mimeType = image.mime_type || image.mimeType || 'image/png';

      return res.status(200).json({
        imageDataUrl: `data:${mimeType};base64,${image.data}`
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'La génération a pris trop de temps. Réessayez.' });
    }

    console.error('RattooInk IA error', error);
    return res.status(500).json({ error: 'Erreur serveur pendant la génération.' });
  }
}
