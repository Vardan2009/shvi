export {
  encodeWAV,
  generatePCM,
  mixPCM,
  pushSamplesToPCM,
  pushSilenceToPCM,
  readWAVPCM,
};

const waveFunctions = {
  [Symbol.for("sine")]: (x) => Math.sin(x), // Sine wave
  [Symbol.for("square")]: (x) => Math.sign(Math.sin(x)), // Square wave
  [Symbol.for("triangle")]: (x) =>
    2 * Math.abs(2 * (x / Math.PI - Math.floor(x / Math.PI + 0.5))) - 1, // Triangle wave
  [Symbol.for("sawtooth")]: (x) =>
    2 * (x / Math.PI - Math.floor(x / Math.PI + 0.5)), // Sawtooth wave
  [Symbol.for("pulse")]: (x, width = 0.5) =>
    (Math.sin(x) >= Math.cos(width * Math.PI)) ? 1 : -1, // Pulse wave (with pulse width control)
};

import globals from "./globals.js";

// sample[n]= A ⋅ sin(2 * π * f * (n / R))

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function pushSamplesToPCM(pcm, samples) {
  for (let i = 0; i < samples.length; ++i) {
    if (pcm.pcmArray.length <= pcm.pcmPtr + i) {
      pcm.pcmArray.push(samples[i]);
    } else {
      pcm.pcmArray[pcm.pcmPtr + i] = mixSamples(
        pcm.pcmArray[pcm.pcmPtr + i],
        samples[i],
      );
    }
  }
}

function pushSilenceToPCM(pcm, sampleCount) {
  for (let i = 0; i < sampleCount; ++i) {
    if (pcm.pcmArray.length <= pcm.pcmPtr + i) {
      pcm.pcmArray.push(0);
    }
  }
}

function resamplePCM(samples, originalRate, targetRate) {
  if (originalRate === targetRate) return samples;

  const ratio = originalRate / targetRate;
  const newLength = Math.floor(samples.length / ratio);
  const newSamples = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const i0 = Math.floor(originalIndex);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const t = originalIndex - i0;

    newSamples[i] = samples[i0] * (1 - t) + samples[i1] * t;
  }

  return Array.from(newSamples);
}

function generatePCM(
  frequency,
  duration,
  envelope = [0, 0, 0, 0],
  startingSampleCount = 0,
  modifiers = {},
) {
  const amplitude = globals.SAMPLE_MAX;
  const sampleRate = globals.SAMPLE_RATE;

  if (!envelope || !Array.isArray(envelope) || envelope.length !== 4) {
    console.error("Shvi: ADSR envelope invalid!", envelope);
    return;
  }

  const [funcName, attack, decay, release] = envelope;

  let vibratoAmplitude = 0, vibratoFrequency = 0;
  if ("vibrato" in modifiers) {
    [vibratoAmplitude, vibratoFrequency] = modifiers.vibrato;
  }

  const audioFunc = waveFunctions[funcName];
  if (!audioFunc) {
    console.error("Shvi: Invalid audio gen function ", funcName);
    return;
  }

  const totalDurationSamples = Math.floor(sampleRate * (duration / 1000));
  const releaseSamples = Math.floor(sampleRate * (release / 1000));

  let attackSamples = Math.floor(sampleRate * (attack / 1000));
  let decaySamples = Math.floor(sampleRate * (decay / 1000));

  const totalADSamples = attackSamples + decaySamples;
  if (totalADSamples > totalDurationSamples) {
    const scale = totalDurationSamples / totalADSamples;
    attackSamples = Math.floor(attackSamples * scale);
    decaySamples = Math.floor(decaySamples * scale);
  }

  const _sustainSamples = Math.max(
    0,
    totalDurationSamples - (attackSamples + decaySamples),
  );

  const adsSamples = [];
  const releasePartSamples = [];

  for (let i = 0; i < totalDurationSamples; i++) {
    const t = (startingSampleCount + i) / sampleRate;

    let adsrFactor = 1;
    const vibrato = vibratoAmplitude * Math.sin(t * vibratoFrequency);

    if (i < attackSamples) {
      adsrFactor = (decaySamples == 0 ? 0.7 : 1) * (i / attackSamples);
    } else if (i < attackSamples + decaySamples) {
      const decayProgress = (i - attackSamples) / decaySamples;
      adsrFactor = 1 - decayProgress * 0.3; // decay to 0.7
    } else {
      adsrFactor = 0.7; // sustain
    }

    const sample = amplitude * adsrFactor *
      audioFunc(2 * Math.PI * frequency * t + vibrato);

    adsSamples.push(sample);
  }

  for (let i = 0; i < releaseSamples; i++) {
    const releaseProgress = i / releaseSamples;
    const adsrFactor = 0.7 * (1 - releaseProgress);
    const t = (totalDurationSamples + startingSampleCount + i) / sampleRate;
    const sample = amplitude * adsrFactor *
      audioFunc(2 * Math.PI * frequency * t);
    releasePartSamples.push(sample);
  }

  return [adsSamples, releasePartSamples];
}

async function encodeWAV(samples, output = "output.wav") {
  const headerSize = 44;
  const numChannels = 2;

  const bitsPerSample = globals.WAV_BITS;
  const sampleRate = globals.SAMPLE_RATE;

  const bytesPerSample = bitsPerSample / 8;
  const dataSize = samples.length * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const offset = headerSize + i * numChannels * bytesPerSample;

    for (let ch = 0; ch < numChannels; ch++) {
      const chOffset = offset + ch * bytesPerSample;

      const clamped = Math.max(
        globals.SAMPLE_MIN,
        Math.min(globals.SAMPLE_MAX, sample),
      );

      if (bitsPerSample === 16) {
        view.setInt16(chOffset, clamped, true);
      } else if (bitsPerSample === 32) {
        view.setInt32(chOffset, clamped, true);
      } else {
        throw new Error(`Shvi: Unsupported WAV bit depth: ${bitsPerSample}`);
      }
    }
  }

  await Deno.writeFile(output, new Uint8Array(buffer));
}

function readWAVPCM(filepath) {
  const contents = Deno.readFileSync(filepath);
  const buffer = contents.buffer.slice(
    contents.byteOffset,
    contents.byteOffset + contents.byteLength,
  );
  const view = new DataView(buffer);

  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== "RIFF") {
    throw new Error("Shvi: Invalid WAV file: missing RIFF header");
  }

  if (String.fromCharCode(...new Uint8Array(buffer, 8, 4)) !== "WAVE") {
    throw new Error("Shvi: Invalid WAV file: missing WAVE header");
  }

  let offset = 12;
  let audioFormat,
    numChannels,
    wavSampleRate,
    _byteRate,
    _blockAlign,
    bitsPerSample;

  while (offset < buffer.byteLength) {
    const chunkId = String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      wavSampleRate = view.getUint32(offset + 12, true);
      _byteRate = view.getUint32(offset + 16, true);
      _blockAlign = view.getUint16(offset + 20, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      break;
    }
    offset += 8 + chunkSize;
  }

  if (audioFormat !== 1) {
    throw new Error("Shvi: Unsupported WAV format: only PCM is supported");
  }

  // 'data' chunk
  offset = 12;
  let dataOffset, dataSize;
  while (offset < buffer.byteLength) {
    const chunkId = String.fromCharCode(...new Uint8Array(buffer, offset, 4));
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }

  const samples = [];
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = dataSize / (bytesPerSample * numChannels);

  for (let i = 0; i < numSamples; i++) {
    let mixedSample = 0;

    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = dataOffset + (i * numChannels + ch) * bytesPerSample;
      let sample;
      if (bitsPerSample === 16) {
        sample = view.getInt16(sampleOffset, true);
      } else if (bitsPerSample === 32) {
        sample = view.getInt32(sampleOffset, true);
      } else {
        throw new Error(`Shvi: Unsupported bits per sample: ${bitsPerSample}`);
      }
      mixedSample += sample;
    }

    mixedSample /= numChannels;

    samples.push(mixedSample * Math.pow(2, bitsPerSample));
  }

  return resamplePCM(samples, wavSampleRate, globals.SAMPLE_RATE);
}

function mixSamples(a, b) {
  return Math.max(
    globals.SAMPLE_MIN,
    Math.min(globals.SAMPLE_MAX, a + b),
  );
}

function mixPCM(PCMs) {
  const numChannels = PCMs.length;
  const maxLength = Math.max(...PCMs.map((pcm) => pcm.length));
  const bits = globals.WAV_BITS;

  const output = bits === 16
    ? new Int16Array(maxLength)
    : bits === 32
    ? new Int32Array(maxLength)
    : (() => {
      throw new Error(`Unsupported WAV_BITS: ${bits}`);
    })();

  const maxVal = globals.SAMPLE_MAX;
  const minVal = globals.SAMPLE_MIN;

  for (let i = 0; i < maxLength; i++) {
    let mixedSample = 0;

    for (let j = 0; j < numChannels; j++) {
      const sample = i < PCMs[j].length ? PCMs[j][i] : 0;
      mixedSample += sample / numChannels;
    }

    output[i] = Math.max(minVal, Math.min(maxVal, mixedSample));
  }

  return output;
}
