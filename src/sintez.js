export { encodeWAV, generatePCM, mixPCM, pushSamplesToPCM, pushSilenceToPCM };

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

function generatePCM(
  frequency,
  duration,
  envelope = [0, 0, 0],
  startingSampleCount,
) {
  const amplitude = 32767;
  const sampleRate = 44100;

  if (!envelope || !Array.isArray(envelope)) {
    console.error("Shvi: ADSR envelope invalid!");
    return;
  }

  const [attack, decay, release] = envelope;

  const totalADSsamples = Math.floor(sampleRate * (duration / 1000));
  const attackSamples = Math.floor(sampleRate * (attack / 1000));
  const decaySamples = Math.floor(sampleRate * (decay / 1000));
  const sustainSamples = Math.max(
    totalADSsamples - (attackSamples + decaySamples),
  );

  const releaseSampleCount = Math.floor(sampleRate * (release / 1000));

  const adsSamples = [];
  const releaseSamples = [];

  for (let i = 0; i < totalADSsamples; i++) {
    let adsrFactor = 1;

    if (i < attackSamples) {
      adsrFactor = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      const decayProgress = (i - attackSamples) / decaySamples;
      adsrFactor = 1 - decayProgress * 0.3; // decay to 0.7
    } else {
      adsrFactor = 0.7; // sustain
    }

    const t = (startingSampleCount + i) / sampleRate;
    const sample = amplitude * adsrFactor *
      Math.sin(2 * Math.PI * frequency * t);
    adsSamples.push(sample);
  }

  for (let i = 0; i < releaseSampleCount; i++) {
    const releaseProgress = i / releaseSampleCount;
    const adsrFactor = 0.7 * (1 - releaseProgress);
    const t = (totalADSsamples + startingSampleCount + i) / sampleRate;
    const sample = amplitude * adsrFactor *
      Math.sin(2 * Math.PI * frequency * t);
    releaseSamples.push(sample);
  }
  return [adsSamples, releaseSamples];
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

function mixSamples(a, b) {
  const mixed = (a + b) / 2;
  return Math.max(-32768, Math.min(32767, mixed));
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
