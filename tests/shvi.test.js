import { encodeWAV, generatePCM } from "../src/sintez.js";
import { evaluate, tokenize } from "../src/interpreter.js";
import { play } from "../src/util.js";

Deno.test("Playing things", async (t) => {
  await t.step({
    name: "playing 261.63 Hz /C4/ for one second",
    fn: async () => {
      const frequency = 261.63; // C4
      const duration = 1000; // 1 second

      const samples = generatePCM(frequency, duration);

      encodeWAV(samples);

      console.log("Playing generated WAV file...");
      await play("output.wav");
    },
    ignore: true,
  });

  await t.step({
    name: "playing a D4 for 200 ms",
    fn: async () => {
      const music = `
            (tone 293.66 200)
          `;

      const symbolTable = {};
      const tokens = tokenize(music);
      const samples = [];
      evaluate(tokens, symbolTable, samples);

      encodeWAV(samples);

      console.log("Playing generated WAV file...");
      await play("output.wav");
    },
    ignore: false,
  });
});
