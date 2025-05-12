export { builtinCommands };
import { generatePCM } from "./sintez.js";
import { evaluateNode } from "./interpreter.js";

const builtinCommands = {
  [Symbol.for("+")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      let sum = 0;
      for (let i = 1; i < expression.length; ++i)
        sum += evaluateNode(expression[i], fullPCM, symbolTable);
      return sum;
    },
  },
  [Symbol.for("-")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      let diff = evaluateNode(expression[1]);
      for (let i = 2; i < expression.length; ++i)
        diff += evaluateNode(expression[i], fullPCM, symbolTable);
      return diff;
    },
  },
  [Symbol.for("*")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      let factor = 0;
      for (let i = 1; i < expression.length; ++i)
        factor *= evaluateNode(expression[i], fullPCM, symbolTable);
      return factor;
    },
  },
  [Symbol.for("/")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      let quotient = evaluateNode(expression[1], fullPCM, symbolTable);
      for (let i = 2; i < expression.length; ++i)
        quotient /= evaluateNode(expression[i], fullPCM, symbolTable);
      return quotient;
    },
  },
  [Symbol.for("tone")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable) => {
      fullPCM.push(
        ...generatePCM(
          evaluateNode(expression[1], fullPCM, symbolTable),
          evaluateNode(expression[2], fullPCM, symbolTable)
        )
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
    fn: (expression, fullPCM, symbolTable) => {
      const val = evaluateNode(expression[2], fullPCM, symbolTable);
      symbolTable[expression[1]] = val;
      return val;
    },
  },
  [Symbol.for("print")]: {
    minOperandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      console.log(
        ...expression.slice(1).map((n) => evaluateNode(n, fullPCM, symbolTable))
      );
      return undefined;
    },
  },
  [Symbol.for("silence")]: {
    operandCount: 1,
    fn: (expression, fullPCM, symbolTable) => {
      fullPCM.push(
        ...generatePCM(0, evaluateNode(expression[1], fullPCM, symbolTable))
      );
      return undefined;
    },
  },
  [Symbol.for("repeat")]: {
    operandCount: 2,
    fn: (expression, fullPCM, symbolTable) => {
      const times = evaluateNode(expression[1], fullPCM, symbolTable);
      for (let i = 0; i < times; ++i)
        evaluateNode(expression[2], fullPCM, symbolTable);
      return undefined;
    },
  },
  [Symbol.for("sequence")]: {
    minOperandCount: 0,
    fn: (expression, fullPCM, symbolTable) => {
      for (let i = 1; i < expression.length; ++i)
        evaluateNode(expression[i], fullPCM, symbolTable);
      return undefined;
    },
  },
};
