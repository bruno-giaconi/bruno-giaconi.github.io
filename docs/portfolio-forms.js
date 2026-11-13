(() => {
  'use strict';
  const root = document.querySelector('[data-portfolio-form-root]');
  if (!root) return;
  const contact = root.dataset.requestKind === 'contact';
  const endpoint = 'https://prince2pm.bgiaconi.chatgpt.site' + (contact ? '/api/portfolio/contact' : '/api/beta/portfolio');
  const fields = contact ? ['email','firstName','lastName','message'] : ['firstName','lastName','jobTitle','email','description'];
  const locale = document.documentElement.lang === 'en' ? 'en' : 'fr';
  const copy = {
    fr: {
      loading: 'Vérification de la disponibilité…', unavailable: 'Les demandes d’accès bêta sont momentanément fermées. Vous pouvez vérifier à nouveau leur disponibilité.',
      configError: 'La disponibilité n’a pas pu être vérifiée. Réessayez dans un instant.', submit: 'Envoyer ma demande', sending: 'Envoi…',
      invalid: 'Vérifiez les champs signalés avant d’envoyer votre demande.', text: 'Renseignez ce champ, avec 120 caractères au maximum.', email: 'Indiquez une adresse e-mail valide, avec 254 caractères au maximum.', description: 'Le message peut contenir jusqu’à 2 000 caractères.',
      uncertain: 'L’envoi n’a pas pu être confirmé. Vos informations sont conservées dans ce formulaire. Vous pouvez réessayer ; aucune nouvelle demande ne sera envoyée automatiquement.',
      limited: 'Trop de demandes ont été envoyées récemment. Patientez avant de réessayer.', wait: seconds => `Vous pourrez réessayer dans ${seconds} s.`,
      unavailableSubmit: 'Les demandes d’accès sont momentanément fermées. Vos informations restent dans ce formulaire. Vérifiez la disponibilité avant de réessayer.',
      rejected: 'La demande n’a pas pu être enregistrée. Vérifiez vos informations, puis réessayez.', unsupported: 'Ce navigateur ne permet pas un envoi sécurisé. Utilisez une version récente de votre navigateur.'
    },
    en: {
      loading: 'Checking availability…', unavailable: 'Beta access requests are temporarily closed. You can check availability again.',
      configError: 'Availability could not be checked. Please try again shortly.', submit: 'Send my request', sending: 'Sending…',
      invalid: 'Check the highlighted fields before sending your request.', text: 'Complete this field using no more than 120 characters.', email: 'Enter a valid email address using no more than 254 characters.', description: 'Your message can contain up to 2,000 characters.',
      uncertain: 'Submission could not be confirmed. Your information remains in this form. You can try again; no request will be retried automatically.',
      limited: 'Too many requests have been sent recently. Please wait before trying again.', wait: seconds => `You can try again in ${seconds} s.`,
      unavailableSubmit: 'Access requests are temporarily closed. Your information remains in this form. Check availability before trying again.',
      rejected: 'Your request could not be saved. Check your information, then try again.', unsupported: 'This browser cannot submit securely. Please use a recent browser version.'
    }
  }[locale];
  copy.tooLarge = locale === 'en' ? 'Your message is too large. Shorten it before sending.' : 'Le message est trop volumineux. Réduisez-le avant de l’envoyer.';
  if (contact) Object.assign(copy, locale === 'en' ? { unavailable:'The contact form is temporarily unavailable. You can check again.', submit:'Send my message', invalid:'Check the highlighted fields before sending your message.', message:'Write your message using no more than 2,000 characters.', uncertain:'Submission could not be confirmed. Your message remains in this form. You can try again; it will not be resent automatically.', unavailableSubmit:'The contact form is temporarily unavailable. Your message remains here. Check availability before trying again.', rejected:'Your message could not be saved. Check the information, then try again.' } : { unavailable:'Le formulaire de contact est momentanément indisponible. Vous pouvez vérifier à nouveau.', submit:'Envoyer mon message', invalid:'Vérifiez les champs signalés avant d’envoyer votre message.', message:'Rédigez votre message, avec 2 000 caractères au maximum.', uncertain:'L’envoi n’a pas pu être confirmé. Votre message reste dans ce formulaire. Vous pouvez réessayer ; il ne sera pas renvoyé automatiquement.', unavailableSubmit:'Le formulaire de contact est momentanément indisponible. Votre message reste ici. Vérifiez la disponibilité avant de réessayer.', rejected:'Votre message n’a pas pu être enregistré. Vérifiez les informations, puis réessayez.' });
  const form = root.querySelector('[data-portfolio-request]'), fieldset = form.querySelector('fieldset');
  if (contact) Object.assign(copy, locale === 'en' ? {
    sentTitle: 'Message sent', sentBody: 'Thank you. Your message has been sent by email.',
    pendingTitle: 'Message recorded', pendingBody: 'Your message has been recorded, but email sending is not confirmed. It will not be resent automatically.'
  } : {
    sentTitle: 'Message envoyé', sentBody: 'Merci. Votre message a été transmis par e-mail.',
    pendingTitle: 'Message enregistré', pendingBody: 'Votre message a été enregistré, mais l’envoi de l’e-mail n’est pas confirmé. Aucun renvoi automatique n’est prévu.'
  });
  const availability = root.querySelector('[data-form-availability]'), reload = root.querySelector('[data-form-reload]');
  const error = root.querySelector('[data-form-error]'), cooldown = root.querySelector('[data-form-cooldown]');
  const submit = root.querySelector('[data-form-submit]'), success = root.querySelector('[data-form-success]');
  let available = false, seenAvailable = false, configuring = false, pending = false, received = false, retryAt = 0, timer, attempt;
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+$/;
  function validContactEmail(value) {
    if (typeof value !== 'string' || value.length > 254) return false;
    const parts = value.split('@'); if (parts.length !== 2) return false;
    const [local, domain] = parts;
    return local.length > 0 && local.length <= 64 && /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
      && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') && domain.includes('.')
      && domain.split('.').every(label => label.length >= 1 && label.length <= 63 && /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label));
  }
  const blocked = () => pending || configuring || received || !available || Date.now() < retryAt;
  function update() {
    submit.disabled = blocked(); fieldset.disabled = pending; reload.disabled = pending || configuring;
    submit.textContent = pending ? copy.sending : copy.submit;
    const seconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    cooldown.hidden = !seconds; cooldown.textContent = seconds ? copy.wait(seconds) : '';
    if (!seconds && timer) { clearInterval(timer); timer = undefined; }
  }
  function showError(message, focus = true) { error.textContent = message; error.hidden = !message; if (message && focus) error.focus(); }
  async function request(method, body, timeout) {
    const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(endpoint, { method, mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      return { response, data };
    } finally { clearTimeout(timeoutId); }
  }
  async function configure() {
    if (configuring || pending || received) return;
    configuring = true; available = false; availability.hidden = false; availability.textContent = copy.loading; reload.hidden = true; update();
    try {
      const { response, data } = await request('GET', null, 20000);
      if (!response.ok || typeof data?.available !== 'boolean' || (!contact && (data.durationHours !== 72 || data.maxAdditionalProjects !== 1 || data.maxUploads !== 5 || data.maxAiAnalyses !== 1))) throw Error('Unconfirmed configuration');
      available = data.available;
      if (available) { seenAvailable = true; showError('', false); }
      availability.hidden = available; availability.textContent = available ? '' : copy.unavailable; reload.hidden = available;
      form.hidden = !seenAvailable;
    } catch { availability.textContent = copy.configError; reload.hidden = false; }
    finally { configuring = false; update(); }
  }
  function values() {
    return Object.fromEntries([...fields, 'website'].map(key => [key, String(form.elements.namedItem(key).value).trim()]));
  }
  function validate(data) {
    let firstInvalid;
    for (const key of fields) {
      const value = data[key], field = form.elements.namedItem(key), message = root.querySelector(`[data-field-error="${key}"]`);
      const valid = key === 'description' || key === 'message' ? (key !== 'message' || value.length > 0) && value.length <= 2000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)
        : value.length > 0 && value.length <= (key === 'email' ? 254 : 120) && !/[\x00-\x1f\x7f]/.test(value) && (key !== 'email' || (contact ? validContactEmail(value) : emailPattern.test(value)));
      field.setAttribute('aria-invalid', String(!valid)); message.hidden = valid; message.textContent = valid ? '' : copy[key === 'description' || key === 'message' ? key : key === 'email' ? 'email' : 'text'];
      if (!valid && !firstInvalid) firstInvalid = field;
    }
    if (firstInvalid) { showError(copy.invalid, false); firstInvalid.focus(); return false; }
    return true;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (blocked()) return;
    const data = values(); showError(''); if (!validate(data)) return;
    if (typeof globalThis.crypto?.randomUUID !== 'function') { showError(copy.unsupported); return; }
    data.email = data.email.toLowerCase(); data.locale = locale;
    const key = JSON.stringify(data);
    if (!attempt || attempt.key !== key) attempt = { key, id: crypto.randomUUID() };
    const body = { ...(!contact ? { action:'request' } : {}), requestId: attempt.id, ...data };
    if (new TextEncoder().encode(JSON.stringify(body)).length > 12000) { showError(copy.tooLarge); return; }
    pending = true; update();
    try {
      const { response, data: result } = await request('POST', body, 55000);
      if (response.status === 202 && result?.ok === true && result.status === 'received' && (!contact || ['sent', 'pending'].includes(result.delivery))) {
        if (contact) {
          success.querySelector('h3').textContent = result.delivery === 'sent' ? copy.sentTitle : copy.pendingTitle;
          success.querySelector('p').textContent = result.delivery === 'sent' ? copy.sentBody : copy.pendingBody;
        }
        received = true; form.hidden = true; availability.hidden = true; reload.hidden = true; success.hidden = false; success.focus();
      } else if (response.status === 429) {
        const seconds = Number(result?.retryAfter ?? response.headers.get('Retry-After'));
        retryAt = Date.now() + Math.max(1, Math.min(3600, Number.isFinite(seconds) && seconds > 0 ? seconds : 60)) * 1000;
        showError(copy.limited); if (timer) clearInterval(timer); timer = setInterval(update, 1000);
      } else if (response.status === 503 && result?.code === (contact ? 'CONTACT_UNAVAILABLE' : 'BETA_UNAVAILABLE')) {
        available = false; reload.hidden = false; availability.hidden = false; availability.textContent = copy.unavailable; showError(copy.unavailableSubmit);
      } else if (response.status === 413) { showError(copy.tooLarge); }
      else if (response.status === 400 || response.status === 409) { showError(copy.rejected); }
      else { showError(copy.uncertain); }
    } catch { showError(copy.uncertain); }
    finally { pending = false; update(); }
  });
  reload.addEventListener('click', configure);
  void configure();
})();
