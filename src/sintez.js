export { encodeWAV, generatePCM, mixPCM };

// sample[n]= A ⋅ sin(2 * π * f * (n / R))

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function generatePCM(frequency, duration) {
  const amplitude = 32767;
  const sampleRate = 44100;

  const numSamples = Math.floor(sampleRate * (duration / 1000));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
    samples.push(sample);
  }

  return samples;
}

async function encodeWAV(samples, output = "output.wav", sampleRate = 44100) {
  const headerSize = 44;
  const numChannels = 2; // stereo
  const bytesPerSample = 2; // 16bit pcm
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
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const offset = headerSize + i * numChannels * bytesPerSample;
    view.setInt16(offset, sample, true); // left channel
    view.setInt16(offset + bytesPerSample, sample, true); // right channel
  }

  await Deno.writeFile(output, new Uint8Array(buffer));
}

function mixPCM(PCMs) {
  const numChannels = PCMs.length;
  const maxLength = Math.max(...PCMs.map((pcm) => pcm.length));
  const mixed = new Int16Array(maxLength);

  const scale = 1 / numChannels; // equal factor for each channel

  for (let i = 0; i < maxLength; i++) {
    let mixedSample = 0;

    for (let j = 0; j < numChannels; j++) {
      const sample = i < PCMs[j].length ? PCMs[j][i] : 0;
      mixedSample += sample * scale;
    }

    // clamp to range of signed 16bit value
    mixed[i] = Math.max(-32768, Math.min(32767, mixedSample));
  }

  return mixed;
}
