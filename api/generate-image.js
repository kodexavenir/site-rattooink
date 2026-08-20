export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY n’est pas configurée dans Vercel. Ajoute-la dans Project Settings → Environment Variables.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const userPrompt = String(body.prompt || '').trim();
    if (!userPrompt) return res.status(400).json({ error: 'Décris ton projet de tatouage.' });
    if (userPrompt.length > 1500) return res.status(400).json({ error: 'Description trop longue. Limite : 1500 caractères.' });

    const prompt = [
      'Tu es l’outil de conception visuelle officiel de RattooInk.',
      'Génère un concept de tatouage original à partir de la demande du client.',
      'Le rendu doit être pensé comme une planche de concept de tatouage professionnelle, lisible par une tatoueuse.',
      'Privilégie un fond blanc ou neutre, une composition claire, un dessin propre et un contraste élevé.',
      'Ne montre pas de corps humain tatoué, sauf si le client demande explicitement une simulation de placement.',
      'N’ajoute ni logo, ni watermark, ni signature, ni texte parasite.',
      'Conserve fidèlement le sujet, le style et les éléments demandés.',
      `Demande du client : ${userPrompt}`
    ].join('\n\n');

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-image',
        input: prompt
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error', data);
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini n’a pas pu générer l’image.' });
    }

    let image = data?.output_image;
    if (!image && Array.isArray(data?.steps)) {
      for (const step of data.steps) {
        for (const block of (step?.content || [])) {
          if (block?.type === 'image' && block?.data) {
            image = block;
            break;
          }
        }
        if (image) break;
      }
    }

    if (!image?.data) {
      return res.status(502).json({ error: 'Gemini a répondu sans image exploitable.' });
    }

    const mimeType = image.mime_type || image.mimeType || 'image/png';
    return res.status(200).json({
      imageDataUrl: `data:${mimeType};base64,${image.data}`
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erreur serveur pendant la génération.' });
  }
}
