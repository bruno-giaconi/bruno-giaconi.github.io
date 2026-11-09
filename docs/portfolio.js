const records = {
  risque: {
    id: 'R-01 · À SUIVRE',
    title: 'Droits incomplets sur les archives',
    description: 'Vérifier les autorisations du dossier pilote avant le transfert.',
  },
  decision: {
    id: 'D-02 · VALIDÉE',
    title: 'Démarrer avec un dossier pilote',
    description: 'Contrôler les droits et la recherche avant d’étendre le périmètre.',
  },
};

const buttons = [...document.querySelectorAll('[data-prince]')];
const output = document.querySelector('#prince-output');

function showRecord(key) {
  if (key === 'mcp') {
    const example = document.createElement('pre');
    example.textContent = JSON.stringify({
      outil: 'list_records',
      périmètre: 'projet-démo',
      résultat: [{ id: 'R-01', statut: 'à suivre' }],
    }, null, 2);
    output.replaceChildren(example);
    return;
  }

  const record = records[key];
  const id = document.createElement('span');
  id.className = 'record-id';
  id.textContent = record.id;
  const title = document.createElement('strong');
  title.textContent = record.title;
  const description = document.createElement('p');
  description.textContent = record.description;
  output.replaceChildren(id, title, description);
}

buttons.forEach((button) => {
  button.addEventListener('click', () => {
    buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    showRecord(button.dataset.prince);
  });
});

const audioButton = document.querySelector('#audio-test');
const audioResult = document.querySelector('#audio-result');

async function measureAudioBlock() {
  audioButton.disabled = true;
  audioResult.textContent = 'Mesure en cours…';
  let context;
  let timer;

  try {
    if (!window.AudioContext) throw new Error('AudioContext indisponible');
    context = new AudioContext({ sampleRate: 48000 });
    if (!context.audioWorklet) throw new Error('AudioWorklet indisponible');
    await context.resume();
    await context.audioWorklet.addModule('myconf-worklet.js');

    const signal = context.createOscillator();
    const volume = context.createGain();
    const processor = new AudioWorkletNode(context, 'radio-pcm');
    volume.gain.value = 0.12;
    signal.frequency.value = 440;
    signal.connect(volume).connect(processor).connect(context.destination);

    const block = await new Promise((resolve, reject) => {
      processor.port.onmessage = (event) => resolve(event.data);
      timer = setTimeout(() => reject(new Error('Délai dépassé')), 5000);
      signal.start();
    });

    let energy = 0;
    for (const sample of block) energy += sample * sample;
    const amplitude = Math.sqrt(energy / block.length);
    const count = new Intl.NumberFormat('fr-CH').format(block.length);
    const rate = new Intl.NumberFormat('fr-CH').format(context.sampleRate);
    audioResult.textContent = `Bloc reçu · ${count} échantillons à ${rate} Hz · RMS ${amplitude.toFixed(3)}.`;
  } catch {
    audioResult.textContent = 'Le navigateur ne permet pas ce test ici. Le processeur et le schéma restent consultables.';
  } finally {
    clearTimeout(timer);
    if (context && context.state !== 'closed') await context.close();
    audioButton.disabled = false;
  }
}

audioButton.addEventListener('click', measureAudioBlock);

const pvButtons = [...document.querySelectorAll('[data-pv]')];
const pvOutput = document.querySelector('#pv-output');
let pvExample;

function renderPV(kicker, headline, note) {
  const id = document.createElement('span');
  id.className = 'record-id';
  id.textContent = kicker;
  const title = document.createElement('strong');
  title.textContent = headline;
  const description = document.createElement('p');
  description.textContent = note;
  pvOutput.replaceChildren(id, title, description);
}

async function showPV(button) {
  if (!pvExample) {
    const response = await fetch('exemple-pv.json');
    if (!response.ok) throw new Error('Exemple indisponible');
    pvExample = await response.json();
  }

  const entry = pvExample.draft.items.find((item) => item.source_id === 'T03');
  const source = pvExample.transcript.find((item) => item.source_id === entry.source_id);
  pvButtons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));

  if (button.dataset.pv === 'source') {
    renderPV(source.source_id + ' · PASSAGE SOURCE', source.text, 'Le passage ne fournit pas de date.');
  } else if (button.dataset.pv === 'draft') {
    renderPV('EN ATTENTE DE VALIDATION', entry.text, 'Source ' + entry.source_id + ' · Échéance ' + (entry.due_date ?? 'non renseignée'));
  } else {
    const approved = pvExample.reviewed_status === 'approved';
    renderPV('RÉSULTAT DE LA REVUE', approved ? 'Brouillon approuvé' : 'Brouillon rejeté', 'La décision est enregistrée par l’étape de validation humaine.');
  }
}

pvButtons.forEach((button) => {
  button.addEventListener('click', () => {
    showPV(button).catch(() => renderPV('EXEMPLE', 'La sortie JSON n’a pas pu être chargée.', 'Rechargez la page pour réessayer.'));
  });
});
