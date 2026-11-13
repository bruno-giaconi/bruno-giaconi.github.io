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
})();
