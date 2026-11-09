// Processeur audio de MyConf, exécuté dans le portfolio sur un signal synthétique.
// Le compteur reste continu entre les appels et les blocs de deux secondes.
class RadioPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Float32Array(sampleRate * 2);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const output = outputs[0]?.[0];
    if (!output) return true;
    output.fill(0);
    const input = inputs[0]?.[0];
    for (let i = 0; i < output.length; i++) {
      this.samples[this.offset++] = input ? input[i] : 0;
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(sampleRate * 2);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('radio-pcm', RadioPCM);
