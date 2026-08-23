(() => {
  const input = document.getElementById('ai-prompt');
  const button = document.getElementById('generate-btn');
  const resultArea = document.getElementById('ai-result-area');
  const loading = document.getElementById('ai-loading');
  const imageContainer = document.getElementById('ai-image-container');
  const generatedImg = document.getElementById('ai-generated-img');
  const errorBox = document.getElementById('ai-error');
  const errorText = document.getElementById('ai-error-text');

  if (!input || !button || !resultArea || !loading || !imageContainer || !generatedImg || !errorBox || !errorText) return;

  const externalWrap = document.createElement('div');
  externalWrap.className = 'mt-8 w-full max-w-3xl';
  externalWrap.innerHTML = `
    <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <p class="text-white font-black uppercase tracking-widest text-sm">Autres moteurs</p>
          <p class="text-gray-500 text-sm mt-1">Utilise ton propre compte. Aucun mot de passe ni clé n’est enregistré par RattooInk.</p>
        </div>
        <button type="button" id="copy-ai-prompt" class="px-4 py-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:border-rattoo-pink/60 transition text-sm font-bold">Copier le prompt</button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" class="external-ai-link px-4 py-3 rounded-xl bg-rattoo-pink text-white font-black text-center hover:bg-white hover:text-rattoo-pink transition">Gemini</a>
        <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" class="external-ai-link px-4 py-3 rounded-xl border border-white/15 text-white font-black text-center hover:border-rattoo-pink hover:text-rattoo-pink transition">AI Studio</a>
        <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" class="external-ai-link px-4 py-3 rounded-xl border border-white/15 text-white font-black text-center hover:border-rattoo-pink hover:text-rattoo-pink transition">ChatGPT</a>
      </div>
      <p id="copy-ai-status" class="text-gray-600 text-xs mt-3 hidden">Prompt copié. Colle-le dans le moteur choisi.</p>
    </div>
  `;

  const aiResultHost = resultArea.parentElement;
  aiResultHost?.appendChild(externalWrap);

  const copyButton = document.getElementById('copy-ai-prompt');
  const copyStatus = document.getElementById('copy-ai-status');
  copyButton?.addEventListener('click', async () => {
    const prompt = input.value.trim();
    if (!prompt) {
      input.focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(buildPrompt(prompt));
      copyStatus?.classList.remove('hidden');
      setTimeout(() => copyStatus?.classList.add('hidden'), 2500);
    } catch {
      errorText.textContent = 'Le navigateur a refusé la copie automatique. Sélectionne le texte et copie-le manuellement.';
      setState('error');
    }
  });

  function buildPrompt(userPrompt) {
    return [
      'RattooInk — concept de tatouage original.',
      'Créer une planche de concept professionnelle, nette et lisible par une tatoueuse.',
      'Fond blanc ou neutre, composition claire, contraste élevé, détails propres.',
      'Respecter fidèlement le sujet et le style demandés.',
      'Sans logo, watermark, signature ou texte parasite.',
      `Demande du client : ${userPrompt}`
    ].join('\n\n');
  }

  function setState(state) {
    resultArea.classList.remove('hidden');
    resultArea.classList.add('flex');
    loading.classList.toggle('hidden', state !== 'loading');
    loading.classList.toggle('flex', state === 'loading');
    imageContainer.classList.toggle('hidden', state !== 'image');
    errorBox.classList.toggle('hidden', state !== 'error');
    errorBox.classList.toggle('flex', state === 'error');
  }

  async function generate() {
    const prompt = input.value.trim();
    if (!prompt) {
      errorText.textContent = 'Décris d’abord ton projet de tatouage.';
      setState('error');
      input.focus();
      return;
    }

    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Création…';
    setState('loading');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 70_000);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'Génération impossible.');
      }

      generatedImg.src = data.imageDataUrl;
      generatedImg.alt = `Concept RattooInk — ${prompt}`;
      setState('image');
    } catch (error) {
      if (error?.name === 'AbortError') {
        errorText.textContent = 'La génération a pris trop de temps. Réessaie dans quelques instants.';
      } else {
        errorText.textContent = error instanceof Error ? error.message : 'Une erreur est survenue.';
      }
      setState('error');
    } finally {
      window.clearTimeout(timeoutId);
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-bolt"></i> Créer';
    }
  }

  button.addEventListener('click', generate);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      generate();
    }
  });
})();
