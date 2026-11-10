document.querySelectorAll('[data-gallery]').forEach(gallery => {
  const tablist = gallery.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = [...gallery.querySelectorAll('[role="tabpanel"]')];
  const controls = gallery.querySelector('[data-gallery-controls]');
  let current = 0;
  function select(index, focus = false) {
    current = index;
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    if (controls) {
      controls.querySelector('[data-gallery-count]').textContent = `${index + 1} / ${tabs.length}`;
      controls.querySelector('[data-gallery-title]').textContent = tabs[index].textContent.trim();
    }
    if (focus) tabs[index].focus();
    if (controls && (focus || controls.contains(document.activeElement))) {
      tablist.scrollLeft = tabs[index].offsetLeft - tablist.offsetLeft - (tablist.clientWidth - tabs[index].clientWidth) / 2;
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); select(next, true); }
    });
  });
  if (controls) {
    controls.querySelector('[data-gallery-prev]').addEventListener('click', () => select((current - 1 + tabs.length) % tabs.length));
    controls.querySelector('[data-gallery-next]').addEventListener('click', () => select((current + 1) % tabs.length));
    controls.hidden = false;
  }
  select(0);
  tablist.hidden = false;
});