import { encodeWAV } from "./src/sintez.js";
import { play } from "./src/util.js";
import { evaluate, lispPrint, tokenize } from "./src/interpreter.js";

import globals from "./src/globals.js";
import { globalSymbolTable } from "./global_symbol_table.js";

console.error = (...datas) =>
  console.log(...datas.map((data) => `\x1b[31m${data}\x1b[0m`));

const processFile = async (filePath, outputPath) => {
  try {
    const fileContent = await Deno.readTextFile(filePath);
    const syntaxTree = tokenize(fileContent);
    const pcm = {
      pcmArray: [],
      pcmPtr: 0,
    };
    evaluate(syntaxTree, globalSymbolTable, pcm);

    if (pcm.pcmArray.length > 0) {
      encodeWAV(pcm.pcmArray, outputPath);
      play(outputPath);
    }
  } catch (err) {
    console.error("Shvi: Error processing file:", err);
  }
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const continuousPCMStream = async (filePath) => {
  const fileContent = await Deno.readTextFile(filePath);
  const syntaxTree = tokenize(fileContent);
  const pcm = {
    pcmArray: [],
    pcmPtr: 0,
  };
  evaluate(syntaxTree, globalSymbolTable, pcm);

  const numChannels = 1;

  const bitsPerSample = globals.WAV_BITS;
  const bytesPerSample = globals.WAV_BITS / 8;

  const buffer = new ArrayBuffer(
    pcm.pcmArray.length * numChannels * bytesPerSample,
  );

  const view = new DataView(buffer);
  const samples = pcm.pcmArray;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const offset = i * numChannels * bytesPerSample;

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

  const bytesWritten = await Deno.stdout.write(
    new Uint8Array(buffer),
  );

  await delay(bytesWritten / globals.SAMPLE_RATE);
  await continuousPCMStream(filePath);
};

const runREPL = () => {
  console.log(`🪈 Shvi ver. ${globals.SHVI_VERSION}`);
  console.log(
    "Type \x1b[32mexit\x1b[0m or press \x1b[32mCtrl+C\x1b[0m to exit\n",
  );

  while (true) {
    let ln = "";
    let line;

    line = prompt("\x1b[33mShvi %\x1b[0m");

    if (line === null || line.trim() === "") continue;
    if (line.trim() === "exit") break;

    while (line.endsWith("\\")) {
      ln += line.slice(0, -1) + "\n";
      line = prompt("   ...");
      if (line === null) break;
    }
    ln += line;

    const syntaxTree = tokenize(ln);
    const pcm = {
      pcmArray: [],
      pcmPtr: 0,
    };

    lispPrint(evaluate(syntaxTree, globalSymbolTable, pcm));

    if (pcm.pcmArray.length > 0) {
      encodeWAV(pcm.pcmArray);
      play("output.wav");
    }
  }
};

const main = async () => {
  let filePath = undefined;
  let outputPath = "output.wav";
  let stream = false;

  for (let i = 0; i < Deno.args.length; ++i) {
    switch (Deno.args[i]) {
      case "-o":
        outputPath = Deno.args[++i];
        break;
      case "-s":
        stream = true;
        break;
      default:
        filePath = Deno.args[i];
        break;
    }
  }

  if (filePath) {
    if (stream) {
      continuousPCMStream(filePath);
    } else {
      try {
        await processFile(filePath, outputPath);
      } catch (err) {
        console.error("Shvi: Error processing file:", err);
      }
    }
  } else runREPL();
};

await main();
