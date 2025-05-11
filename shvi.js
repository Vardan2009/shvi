import { tokenize, evaluate, encodeWAV } from "./sintez.js";
import { play } from "./util.js";
const globalSymbolTable = {};
while (true) {
  const ln = prompt("Shvi 🪈 ]");
  const syntaxTree = tokenize(ln);
  const pcm = evaluate(syntaxTree, globalSymbolTable);
  if (pcm.length > 0) {
    encodeWAV(pcm);
    play("output.wav");
  }
}
