/**
 * WebAudio SFX — everything is synthesised so there are no assets to
 * load. Created lazily on the first user gesture (pointer lock click).
 */

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  private volume = 0.7;
  private muted = false;
  private motorOsc: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private ambientNodes: { stop: () => void } | null = null;
  private stepFlip = false;

  setVolume(volume01: number, muted: boolean): void {
    this.volume = Math.min(1, Math.max(0, volume01));
    this.muted = muted;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.32 * (0.25 + this.volume * 0.75), this.ctx.currentTime, 0.05);
    }
  }

  /** Continuous, speed-responsive engine hum. Silence immediately on pause. */
  motor(speed: number, active: boolean): void {
    if (!active) {
      if (this.ctx && this.motorGain) this.motorGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }
    if (!this.ensure() || !this.ctx || !this.master) return;
    if (!this.motorOsc) {
      this.motorOsc = this.ctx.createOscillator();
      this.motorOsc.type = "sawtooth";
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.value = 260;
      this.motorGain = this.ctx.createGain();
      this.motorGain.gain.value = 0;
      this.motorOsc.connect(filter).connect(this.motorGain).connect(this.master);
      this.motorOsc.start();
    }
    this.motorOsc.frequency.setTargetAtTime(32 + Math.min(1, speed) * 100, this.ctx.currentTime, 0.12);
    this.motorGain!.gain.setTargetAtTime(0.07 + speed * 0.09, this.ctx.currentTime, 0.08);
  }

  /** Low wind bed so the compound feels alive even when quiet. */
  startAmbient(): void {
    if (this.ambientNodes || !this.ensure() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    this.ambientNodes = { stop: () => { try { src.stop(); lfo.stop(); } catch { /* already stopped */ } } };
  }

  private ensure(): boolean {
    if (!this.enabled) return false;
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32 * (0.25 + this.volume * 0.75);
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  private noise(duration: number, gain: number, filterFreq: number): void {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start();
  }

  private blip(freq: number, duration: number, gain: number, type: OscillatorType = "square"): void {
    if (!this.ensure() || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(g).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  shotShotgun(): void {
    this.noise(0.22, 0.65, 1400);
    this.blip(110, 0.14, 0.2, "sawtooth");
  }

  shotPistol(): void {
    this.noise(0.09, 0.4, 3200);
    this.blip(240, 0.05, 0.12, "sawtooth");
  }

  shot(): void {
    this.noise(0.12, 0.5, 2600);
    this.blip(180, 0.07, 0.16, "sawtooth");
  }

  enemyShot(distance: number): void {
    const atten = Math.max(0.05, 1 - distance / 70);
    this.noise(0.1, 0.35 * atten, 1400);
  }

  sniperShot(distance: number): void {
    const atten = Math.max(0.05, 1 - distance / 120);
    this.noise(0.3, 0.55 * atten, 900);
    this.blip(90, 0.2, 0.2 * atten, "sawtooth");
  }

  hit(): void {
    this.blip(1400, 0.05, 0.14, "square");
  }

  headshot(): void {
    this.blip(1900, 0.06, 0.15, "square");
    window.setTimeout(() => this.blip(2400, 0.07, 0.12, "square"), 45);
  }

  kill(): void {
    this.blip(700, 0.09, 0.16, "square");
    window.setTimeout(() => this.blip(1050, 0.12, 0.14, "square"), 70);
  }

  streak(count: number): void {
    const base = 600 + Math.min(count, 6) * 120;
    this.blip(base, 0.08, 0.15, "square");
    window.setTimeout(() => this.blip(base * 1.25, 0.1, 0.14, "square"), 70);
    window.setTimeout(() => this.blip(base * 1.5, 0.14, 0.14, "square"), 140);
  }

  levelup(): void {
    const notes = [392, 523, 659, 784, 1046];
    notes.forEach((n, i) =>
      window.setTimeout(() => this.blip(n, 0.16, 0.14, "triangle"), i * 90),
    );
  }

  achievement(): void {
    this.blip(880, 0.1, 0.13, "triangle");
    window.setTimeout(() => this.blip(1174, 0.14, 0.13, "triangle"), 100);
  }

  checkpoint(): void {
    this.blip(660, 0.08, 0.14, "sine");
    window.setTimeout(() => this.blip(990, 0.12, 0.13, "sine"), 90);
  }

  pickup(): void {
    this.blip(520, 0.06, 0.12, "triangle");
    window.setTimeout(() => this.blip(780, 0.08, 0.12, "triangle"), 60);
  }

  empty(): void {
    this.blip(180, 0.04, 0.1, "square");
  }

  step(sprinting: boolean): void {
    this.stepFlip = !this.stepFlip;
    this.noise(0.05, sprinting ? 0.14 : 0.09, this.stepFlip ? 900 : 750);
  }

  uiClick(): void {
    this.blip(700, 0.04, 0.08, "sine");
  }

  reload(): void {
    this.blip(320, 0.05, 0.12, "square");
    window.setTimeout(() => this.blip(240, 0.06, 0.12, "square"), 220);
    window.setTimeout(() => this.blip(420, 0.05, 0.12, "square"), 1250);
  }

  hurt(): void {
    this.noise(0.18, 0.4, 700);
  }

  interact(): void {
    this.blip(880, 0.08, 0.14, "sine");
    window.setTimeout(() => this.blip(1320, 0.1, 0.12, "sine"), 80);
  }

  mission(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) =>
      window.setTimeout(() => this.blip(n, 0.22, 0.16, "sine"), i * 150),
    );
  }

  death(): void {
    this.blip(300, 0.5, 0.2, "sawtooth");
    window.setTimeout(() => this.blip(150, 0.7, 0.2, "sawtooth"), 180);
  }
}

export const sfx = new Sfx();
