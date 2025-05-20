import { encodeWAV } from "./src/sintez.js";
import { play } from "./src/util.js";
import { evaluate, tokenize } from "./src/interpreter.js";

import { globalSymbolTable } from "./global_symbol_table.js";

const processFile = async (filePath) => {
  try {
    const fileContent = await Deno.readTextFile(filePath);
    const syntaxTree = tokenize(fileContent);
    const pcm = {
      pcmArray: [],
      pcmPtr: 0,
    };
    evaluate(syntaxTree, globalSymbolTable, pcm);

    if (pcm.pcmArray.length > 0) {
      encodeWAV(pcm.pcmArray);
      play("output.wav");
    }
  } catch (err) {
    console.error("Shvi: Error processing file:", err);
  }
};

const runREPL = () => {
  while (true) {
    let ln = "";
    let line;

    line = prompt("Shvi %");

    if (line === null || line.trim() === "") break;

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
    evaluate(syntaxTree, globalSymbolTable, pcm);
    if (pcm.pcmArray.length > 0) {
      encodeWAV(pcm.pcmArray);
      play("output.wav");
    }
  }
};

const main = async () => {
  if (Deno.args.length > 0) {
    const filePath = Deno.args[0];
    try {
      await processFile(filePath);
    } catch (err) {
      console.error("Shvi: Error processing file:", err);
    }
  } else runREPL();
};

await main();
