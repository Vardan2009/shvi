export { builtinCommands };
import {
  generatePCM,
  mixPCM,
  pushSamplesToPCM,
  pushSilenceToPCM,
  readWAVPCM,
} from "./sintez.js";
import { evaluateNode } from "./interpreter.js";
const builtinCommands = {
  [Symbol.for("+")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      let sum = 0;
      for (let i = 1; i < expression.length; ++i) {
        sum += evaluateNode(expression[i], fullPCM, symbolTable, envelope);
      }
      return sum;
    },
  },
  [Symbol.for("-")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      let diff = evaluateNode(expression[1]);
      for (let i = 2; i < expression.length; ++i) {
        diff -= evaluateNode(expression[i], fullPCM, symbolTable, envelope);
      }
      return diff;
    },
  },
  [Symbol.for("*")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      let factor = 1;
      for (let i = 1; i < expression.length; ++i) {
        factor *= evaluateNode(expression[i], fullPCM, symbolTable, envelope);
      }
      return factor;
    },
  },
  [Symbol.for("/")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      let quotient = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
      );
      for (let i = 2; i < expression.length; ++i) {
        quotient /= evaluateNode(expression[i], fullPCM, symbolTable, envelope);
      }
      return quotient;
    },
  },
  [Symbol.for("tone")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [pcm, releasePCM] = generatePCM(
        evaluateNode(expression[1], fullPCM, symbolTable, envelope),
        evaluateNode(expression[2], fullPCM, symbolTable, envelope),
        envelope,
        fullPCM.pcmPtr,
      );

      pushSamplesToPCM(fullPCM, [...pcm, ...releasePCM]);
      fullPCM.pcmPtr += pcm.length;

      return undefined;
    },
  },
  [Symbol.for("quote")]: {
    operandCount: 1,
    fn: (expression, _fullPCM, _symbolTable, _envelope) => {
      return expression[1];
    },
  },
  [Symbol.for("let")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const val = evaluateNode(expression[2], fullPCM, symbolTable, envelope);
      symbolTable[expression[1]] = val;
      return val;
    },
  },
  [Symbol.for("print")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      console.log(
        ...expression.slice(1).map((n) =>
          evaluateNode(n, fullPCM, symbolTable, envelope)
        ),
      );
      return undefined;
    },
  },
  [Symbol.for("silence")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const duration = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
      );
      const sampleCount = Math.floor((duration / 1000) * 44100);

      pushSilenceToPCM(fullPCM, sampleCount);
      fullPCM.pcmPtr += sampleCount;

      return undefined;
    },
  },
  [Symbol.for("repeat")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const times = evaluateNode(expression[1], fullPCM, symbolTable, envelope);
      for (let i = 0; i < times; ++i) {
        evaluateNode(expression[2], fullPCM, symbolTable, envelope);
      }
      return undefined;
    },
  },
  [Symbol.for("sequence")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length; ++i) {
        evaluateNode(expression[i], fullPCM, symbolTable, envelope);
      }
      return undefined;
    },
  },
  [Symbol.for("parallel")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const PCMs = [];
      for (let i = 1; i < expression.length; ++i) {
        const commandPCM = {
          pcmArray: [],
          pcmPtr: 0,
        };
        evaluateNode(expression[i], commandPCM, symbolTable, envelope);
        PCMs.push(commandPCM);
      }

      const ptrIncrement = Math.max(...PCMs.map((pcm) => pcm.pcmPtr));
      const samples = PCMs.map((pcm) => pcm.pcmArray);

      // fullPCM.push(...mixPCM(PCMs));
      pushSamplesToPCM(fullPCM, mixPCM(samples));

      fullPCM.pcmPtr += ptrIncrement;

      return undefined;
    },
  },
  [Symbol.for("chord")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const array = evaluateNode(expression[1], fullPCM, symbolTable, envelope);
      if (!array) return;
      const duration = evaluateNode(
        expression[2],
        fullPCM,
        symbolTable,
        envelope,
      );

      const PCMs = [];
      const releasePCMs = [];

      array.forEach((el) => {
        const [pcm, releasePcm] = generatePCM(
          evaluateNode(el, fullPCM, symbolTable, envelope),
          duration,
          envelope,
          fullPCM.pcmPtr,
        );
        PCMs.push(pcm);
        releasePCMs.push(releasePcm);
      });

      pushSamplesToPCM(fullPCM, [...mixPCM(PCMs), ...mixPCM(releasePCMs)]);
      fullPCM.pcmPtr += PCMs[0].length;

      return undefined;
    },
  },
  [Symbol.for("instrument")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, _envelope) => {
      const newEnvelope = evaluateNode(expression[1], fullPCM, symbolTable);
      const statement = expression[2];
      return evaluateNode(statement, fullPCM, symbolTable, newEnvelope);
    },
  },
  [Symbol.for("lambda")]: {
    operandCount: 2,
    fn: (expression, _fullPCM, _symbolTable, _envelope) => {
      return {
        isLambda: true,
        arguments: expression[1],
        root: expression[2],
      };
    },
  },
  [Symbol.for("wav")]: {
    operandCount: 1,
    fn: (expression, fullPCM, _symbolTable, _envelope) => {
      const filepath = expression[1].description;
      const samples = readWAVPCM(filepath);
      pushSamplesToPCM(fullPCM, samples);
      fullPCM.pcmPtr += samples.length;
      return undefined;
    },
  },
  [Symbol.for("interleave")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [_cmd, toInterleave, root] = expression;
      if (!Array.isArray(root) || (root[0] != Symbol.for("sequence"))) {
        console.error("Shvi: interleave takes a sequence as second operand");
        return;
      }
      root.slice(1).forEach((command) => {
        evaluateNode(command, fullPCM, symbolTable, envelope);
        evaluateNode(toInterleave, fullPCM, symbolTable, envelope);
      });

      return undefined;
    },
  },
};
