import { tokenize, evaluate, encodeWAV } from "./sintez.js";
import { play } from "./util.js";

const createNoteFrequencySymbolTable = () => {
  const table = {};
  const noteNames = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ];
  const enharmonics = {
    "C#": "Db",
    "D#": "Eb",
    "F#": "Gb",
    "G#": "Ab",
    "A#": "Bb",
  };

  for (let octave = 0; octave <= 8; octave++) {
    for (let i = 0; i < noteNames.length; i++) {
      const note = noteNames[i];
      const noteName = note + octave;
      const semitoneIndex = octave * 12 + i;
      const frequency = +(440 * Math.pow(2, (semitoneIndex - 57) / 12)).toFixed(
        2
      );

      table[Symbol.for(noteName)] = frequency;

      if (enharmonics[note]) {
        const enharmonicName = enharmonics[note] + octave;
        table[Symbol.for(enharmonicName)] = frequency;
      }
    }
  }

  return table;
};

const globalSymbolTable = createNoteFrequencySymbolTable();
async function processFile(filePath) {
  try {
    const fileContent = await Deno.readTextFile(filePath); // Read the entire file
    const syntaxTree = tokenize(fileContent); // Tokenize the whole content at once
    const pcm = [];
    evaluate(syntaxTree, globalSymbolTable, pcm); // Evaluate the entire content

    if (pcm.length > 0) {
      encodeWAV(pcm);
      play("output.wav");
    }
  } catch (err) {
    console.error("Error processing file:", err);
  }
}

function runREPL() {
  while (true) {
    const ln = prompt("Shvi 🪈 ] ");
    if (ln === null || ln.trim() === "") break;
    const syntaxTree = tokenize(ln);
    const pcm = [];
    evaluate(syntaxTree, globalSymbolTable, pcm);
    if (pcm.length > 0) {
      encodeWAV(pcm);
      play("output.wav");
    }
  }
}

async function main() {
  if (Deno.args.length > 0) {
    const filePath = Deno.args[0];
    try {
      await processFile(filePath);
    } catch (err) {
      console.error("Error processing file:", err);
    }
  } else runREPL();
}

await main();
