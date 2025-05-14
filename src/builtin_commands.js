export { builtinCommands };
import { generatePCM, mixPCM } from "./sintez.js";
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
      fullPCM.push(
        ...generatePCM(
          evaluateNode(expression[1], fullPCM, symbolTable, envelope),
          evaluateNode(expression[2], fullPCM, symbolTable, envelope),
          envelope,
        ),
      );
      return undefined;
    },
  },
  [Symbol.for("define")]: {
    operandCount: 2,
    fn: (expression, _fullPCM, symbolTable) => {
      symbolTable[expression[1]] = expression[2];
      return undefined;
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
      fullPCM.push(
        ...generatePCM(
          0,
          evaluateNode(expression[1], fullPCM, symbolTable, envelope),
        ),
      );
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
        const commandPCM = [];
        evaluateNode(expression[i], commandPCM, symbolTable, envelope);
        PCMs.push(commandPCM);
      }

      fullPCM.push(...mixPCM(PCMs));

      return undefined;
    },
  },
  [Symbol.for("chord")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable, envelope) => {
      const array = expression[1];
      const duration = evaluateNode(
        expression[2],
        fullPCM,
        symbolTable,
        envelope,
      );

      const PCMs = [];
      array.forEach((el) =>
        PCMs.push(
          generatePCM(
            evaluateNode(el, fullPCM, symbolTable, envelope),
            duration,
            envelope,
          ),
        )
      );

      fullPCM.push(...mixPCM(PCMs));

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
};
