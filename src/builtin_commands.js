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

const isFalsy = (val) => {
  return val === undefined ||
    val === false ||
    val === Symbol.for("nil") ||
    (Array.isArray(val) && val.length === 0);
};

const lispCompare = (a, b) => {
  const normalize = (val) => isFalsy(val) ? false : val;
  return normalize(a) === normalize(b);
};

const lispPrint = (...vals) => {
  console.log(...vals.map((val) => {
    if (val === true) return "T";
    if (isFalsy(val)) return "nil";
    return val;
  }));
};

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
  [Symbol.for("=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const first = evaluateNode(expression[1], fullPCM, symbolTable, envelope);
      for (let i = 2; i < expression.length; ++i) {
        const current = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (!lispCompare(current, first)) return false;
      }
      return true;
    },
  },
  [Symbol.for("/=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const values = [];
      for (let i = 1; i < expression.length; ++i) {
        const val = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
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
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (!(a < b)) return false;
      }
      return true;
    },
  },
  [Symbol.for(">")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (!(a > b)) return false;
      }
      return true;
    },
  },
  [Symbol.for("<=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (!(a <= b)) return false;
      }
      return true;
    },
  },
  [Symbol.for(">=")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length - 1; ++i) {
        const a = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
        const b = evaluateNode(
          expression[i + 1],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (!(a >= b)) return false;
      }
      return true;
    },
  },
  [Symbol.for("and")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      let result;
      for (let i = 1; i < expression.length; ++i) {
        result = evaluateNode(expression[i], fullPCM, symbolTable, envelope);
        if (!result) return result;
      }
      return result;
    },
  },
  [Symbol.for("or")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      for (let i = 1; i < expression.length; ++i) {
        const result = evaluateNode(
          expression[i],
          fullPCM,
          symbolTable,
          envelope,
        );
        if (result) return result;
      }
      return false;
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
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [_, bindings, ...body] = expression;

      const localScope = new SymbolTable({}, symbolTable);

      for (const [varName, valueExpr] of bindings) {
        const val = evaluateNode(valueExpr, fullPCM, symbolTable, envelope);
        localScope.declareSymbol(varName, val);
      }

      let result;
      for (const expr of body) {
        result = evaluateNode(expr, fullPCM, localScope, envelope);
      }

      return result;
    },
  },
  [Symbol.for("setf")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const val = evaluateNode(expression[2], fullPCM, symbolTable, envelope);
      symbolTable.setSymbol(expression[1], val);
      return val;
    },
  },
  [Symbol.for("print")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      lispPrint(
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
    fn: (expression, _fullPCM, symbolTable, _envelope) => {
      return {
        isLambda: true,
        arguments: expression[1],
        root: expression[2],
        closure: new SymbolTable({}, symbolTable),
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
  [Symbol.for("cons")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [_cmd, firstNode, restNode] = expression;
      const first = evaluateNode(firstNode, fullPCM, symbolTable, envelope);
      const rest = evaluateNode(restNode, fullPCM, symbolTable, envelope);
      return Array.isArray(rest) ? [first, ...rest] : [first, rest];
    },
  },
  [Symbol.for("car")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [_cmd, listNode] = expression;
      const list = evaluateNode(listNode, fullPCM, symbolTable, envelope);
      return list[0];
    },
  },
  [Symbol.for("cdr")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const [_cmd, listNode] = expression;
      const list = evaluateNode(listNode, fullPCM, symbolTable, envelope);
      return list.slice(1);
    },
  },
  [Symbol.for("cond")]: {
    minOperandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      if ((expression.length - 1) % 2 != 0) {
        console.log(`Shvi: incorrect cond syntax`);
        return;
      }

      for (let i = 1; i < expression.length; i += 2) {
        if (
          (typeof expression[i] === "symbol" &&
            Symbol.keyFor(expression[i]) === "else") ||
          !isFalsy(evaluateNode(expression[i], fullPCM, symbolTable, envelope))
        ) {
          return evaluateNode(
            expression[i + 1],
            fullPCM,
            symbolTable,
            envelope,
          );
        }
      }

      console.error("Shvi: cond requires an else case");
    },
  },
  [Symbol.for("list")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      return expression.slice(1).map((expr) =>
        evaluateNode(expr, fullPCM, symbolTable, envelope)
      );
    },
  },
};
