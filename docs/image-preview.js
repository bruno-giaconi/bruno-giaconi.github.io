const previewDialog = document.querySelector('.image-preview-dialog');
if (previewDialog && typeof previewDialog.showModal === 'function') {
  let trigger = null;
  document.querySelectorAll('[data-image-preview]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (previewDialog.open) return;
      trigger = link;
      previewDialog.showModal();
      document.body.classList.add('image-preview-open');
      previewDialog.querySelector('[data-image-preview-close]').focus();
    });
  });
  previewDialog.querySelector('[data-image-preview-close]').addEventListener('click', () => previewDialog.close());
  previewDialog.addEventListener('click', event => { if (event.target === previewDialog) previewDialog.close(); });
  previewDialog.addEventListener('close', () => {
    document.body.classList.remove('image-preview-open');
    if (trigger && trigger.isConnected) trigger.focus({preventScroll:true});
    trigger = null;
  });
}
