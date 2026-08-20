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

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      if (!response.ok || !data.imageDataUrl) throw new Error(data.error || 'Génération impossible.');

      generatedImg.src = data.imageDataUrl;
      generatedImg.alt = `Concept RattooInk — ${prompt}`;
      setState('image');
    } catch (error) {
      errorText.textContent = error instanceof Error ? error.message : 'Une erreur est survenue.';
      setState('error');
    } finally {
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
