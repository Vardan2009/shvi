export { builtinCommands };
import {
  generatePCM,
  mixPCM,
  pushSamplesToPCM,
  pushSilenceToPCM,
  readWAVPCM,
} from "./sintez.js";
import { evaluateNode } from "./interpreter.js";
import { SymbolTable } from "./symbol_table.js";

import { isFalsy, lispCompare, lispPrint } from "./interpreter.js";

const builtinCommands = {
  [Symbol.for("+")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let sum = 0;
      for (let i = 1; i < expression.length; ++i) {
        sum += evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
      }
      return sum;
    },
  },
  [Symbol.for("-")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let diff = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      for (let i = 2; i < expression.length; ++i) {
        diff -= evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
      }
      return diff;
    },
  },
  [Symbol.for("*")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let factor = 1;
      for (let i = 1; i < expression.length; ++i) {
        factor *= evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
      }
      return factor;
    },
  },
  [Symbol.for("/")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let quotient = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      for (let i = 2; i < expression.length; ++i) {
        quotient /= evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
      }
      return quotient;
    },
  },
  [Symbol.for("=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const first = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      for (let i = 2; i < expression.length; ++i) {
        const current = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!lispCompare(current, first)) return false;
      }
      return true;
    },
  },
  [Symbol.for("/=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const values = [];
      for (let i = 1; i < expression.length; ++i) {
        const val = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        for (let j = 0; j < values.length; ++j) {
          if (lispCompare(val, values[j])) return false;
        }
        values.push(val);
      }
      return true;
    },
  },
  [Symbol.for("<")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!(a < b)) return false;
      }
      return true;
    },
  },
  [Symbol.for(">")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!(a > b)) return false;
      }
      return true;
    },
  },
  [Symbol.for("<=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!(a <= b)) return false;
      }
      return true;
    },
  },
  [Symbol.for(">=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!(a >= b)) return false;
      }
      return true;
    },
  },
  [Symbol.for("and")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let result;
      for (let i = 1; i < expression.length; ++i) {
        result = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (!result) return result;
      }
      return result;
    },
  },
  [Symbol.for("or")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      for (let i = 1; i < expression.length; ++i) {
        const result = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
        if (result) return result;
      }
      return false;
    },
  },
  [Symbol.for("tone")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const [pcm, releasePCM] = generatePCM(
        evaluateNode(expression[1], fullPCM, symbolTable, envelope, modifiers),
        evaluateNode(expression[2], fullPCM, symbolTable, envelope, modifiers),
        envelope,
        fullPCM.pcmPtr,
        modifiers,
      );

      pushSamplesToPCM(fullPCM, [...pcm, ...releasePCM]);
      fullPCM.pcmPtr += pcm.length;

      return undefined;
    },
  },
  [Symbol.for("quote")]: {
    operandCount: 1,
    fn: (expression, _fullPCM, _symbolTable, _envelope, _modifiers) => {
      return expression[1];
    },
  },
  [Symbol.for("let")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const [_, bindings, ...body] = expression;

      const localScope = new SymbolTable({}, symbolTable);

      for (const [varName, valueExpr] of bindings) {
        const val = evaluateNode(
          valueExpr,
          fullPCM,
          localScope,
          envelope,
          modifiers,
        );
        localScope.declareSymbol(varName, val);
      }

      let result;
      for (const expr of body) {
        result = evaluateNode(expr, fullPCM, localScope, envelope, modifiers);
      }

      return result;
    },
  },
  [Symbol.for("setf")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const val = evaluateNode(
        expression[2],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      symbolTable.setSymbol(expression[1], val);
      return val;
    },
  },
  [Symbol.for("print")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      lispPrint(
        ...expression.slice(1).map((n) =>
          evaluateNode(n, fullPCM, symbolTable, envelope, modifiers)
        ),
      );
      return undefined;
    },
  },
  [Symbol.for("vibrato")]: {
    operandCount: 3,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const amplitude = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      const frequency = evaluateNode(
        expression[2],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );

      return evaluateNode(
        expression[3],
        fullPCM,
        symbolTable,
        envelope,
        {
          ...modifiers,
          ...{
            "vibrato": [
              amplitude,
              frequency,
            ],
          },
        },
      );
    },
  },
  [Symbol.for("silence")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const duration = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      const sampleCount = Math.floor((duration / 1000) * 44100);

      pushSilenceToPCM(fullPCM, sampleCount);
      fullPCM.pcmPtr += sampleCount;

      return undefined;
    },
  },
  [Symbol.for("repeat")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const times = evaluateNode(expression[1], fullPCM, symbolTable, envelope);
      for (let i = 0; i < times; ++i) {
        evaluateNode(expression[2], fullPCM, symbolTable, envelope, modifiers);
      }
      return undefined;
    },
  },
  [Symbol.for("sequence")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      let result;
      for (let i = 1; i < expression.length; ++i) {
        result = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
          modifiers,
        );
      }
      return result;
    },
  },
  [Symbol.for("parallel")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const PCMs = [];
      for (let i = 1; i < expression.length; ++i) {
        const commandPCM = {
          pcmArray: [],
          pcmPtr: 0,
        };
        evaluateNode(
          expression[i],
          commandPCM,
          symbolTable,
          envelope,
          modifiers,
        );
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
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const array = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      if (!array) return;
      const duration = evaluateNode(
        expression[2],
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );

      const PCMs = [];
      const releasePCMs = [];

      array.forEach((el) => {
        const [pcm, releasePcm] = generatePCM(
          evaluateNode(el, fullPCM, symbolTable, envelope, modifiers),
          duration,
          envelope,
          fullPCM.pcmPtr,
          modifiers,
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
    fn: (expression, fullPCM, symbolTable, _envelope, modifiers) => {
      const newEnvelope = evaluateNode(
        expression[1],
        fullPCM,
        symbolTable,
        modifiers,
      );
      const statement = expression[2];
      return evaluateNode(
        statement,
        fullPCM,
        symbolTable,
        newEnvelope,
        modifiers,
      );
    },
  },
  [Symbol.for("lambda")]: {
    minOperandCount: 2,
    fn: (expression, _fullPCM, symbolTable, _envelope, _modifiers) => {
      const lambda = {
        isLambda: true,
        arguments: expression[1],
        root: expression[2],
        closure: new SymbolTable({}, symbolTable),
      };
      return lambda;
    },
  },
  [Symbol.for("wav")]: {
    operandCount: 1,
    fn: (expression, fullPCM, _symbolTable, _envelope, _modifiers) => {
      const filepath = expression[1].description;
      const samples = readWAVPCM(filepath);
      pushSamplesToPCM(fullPCM, samples);
      fullPCM.pcmPtr += samples.length;
      return undefined;
    },
  },
  [Symbol.for("cons")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const [_cmd, firstNode, restNode] = expression;
      const first = evaluateNode(
        firstNode,
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      const rest = evaluateNode(
        restNode,
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      return Array.isArray(rest) ? [first, ...rest] : [first, rest];
    },
  },
  [Symbol.for("car")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const [_cmd, listNode] = expression;
      const list = evaluateNode(
        listNode,
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      return list[0];
    },
  },
  [Symbol.for("cdr")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      const [_cmd, listNode] = expression;
      const list = evaluateNode(
        listNode,
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      );
      return list.slice(1);
    },
  },
  [Symbol.for("cond")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      if ((expression.length - 1) % 2 != 0) {
        console.log(`Shvi: incorrect cond syntax`);
        return;
      }

      for (let i = 1; i < expression.length; i += 2) {
        if (
          (typeof expression[i] === "symbol" &&
            Symbol.keyFor(expression[i]) === "else") ||
          !isFalsy(
            evaluateNode(
              expression[i],
              fullPCM,
              symbolTable,
              envelope,
              modifiers,
            ),
          )
        ) {
          return evaluateNode(
            expression[i + 1],
            fullPCM,
            symbolTable,
            envelope,
            modifiers,
          );
        }
      }

      console.error("Shvi: cond requires an else case");
    },
  },
  [Symbol.for("list")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) => {
      return expression.slice(1).map((expr) =>
        evaluateNode(expr, fullPCM, symbolTable, envelope, modifiers)
      );
    },
  },
  [Symbol.for("eval")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope, modifiers) =>
      evaluateNode(
        evaluateNode(expression[1], fullPCM, symbolTable, envelope, modifiers),
        fullPCM,
        symbolTable,
        envelope,
        modifiers,
      ),
  },
};
