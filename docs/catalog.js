(() => {
  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('[data-project]')];
  const count = document.querySelector('#result-count');
  const english = document.documentElement.lang.startsWith('en');

  filters.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter;
    filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    let visible = 0;
    cards.forEach(card => {
      card.hidden = category !== 'all' && card.dataset.project !== category;
      if (!card.hidden) visible++;
    });
    if (count) {
      const plural = english ? visible !== 1 : visible > 1;
      count.textContent = `${visible} application${plural ? 's' : ''}`;
    }
  }));

  const copyButton = document.querySelector('[data-copy-email]');
  const copyStatus = document.querySelector('#contact-copy-status');
  const copyFallback = document.querySelector('#contact-copy-fallback');
  const emailInput = document.querySelector('#contact-email');
  if (!copyButton || !copyStatus || !copyFallback || !emailInput) return;

  // Mail and Gmail remain available when JavaScript or clipboard access is unavailable.
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    if (copyButton.disabled) return;
    copyButton.disabled = true;
    copyStatus.textContent = '';
    const email = copyButton.dataset.copyEmail;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(email);
      copyFallback.hidden = true;
      copyStatus.textContent = english ? 'Email address copied.' : 'Adresse copiée.';
    } catch {
      copyFallback.hidden = false;
      emailInput.value = email;
      emailInput.focus({ preventScroll: true });
      emailInput.select();
      emailInput.setSelectionRange(0, email.length);
      copyStatus.textContent = english
        ? 'The address is selected below. Copy it using your keyboard or your device’s menu.'
        : 'L’adresse est sélectionnée ci-dessous. Copiez-la avec votre clavier ou le menu de votre appareil.';
    } finally {
      copyButton.disabled = false;
    }
  });
})();
