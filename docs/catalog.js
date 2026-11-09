const filters = [...document.querySelectorAll('[data-filter]')];
const cards = [...document.querySelectorAll('[data-project]')];
const count = document.querySelector('#result-count');
filters.forEach(button => button.addEventListener('click', () => {
  const category = button.dataset.filter;
  filters.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  let visible = 0;
  cards.forEach(card => {
    card.hidden = category !== 'all' && card.dataset.project !== category;
    if (!card.hidden) visible++;
  });
  count.textContent = `${visible} application${visible > 1 ? 's' : ''}`;
}));
