export { tokenize, evaluate };
import { generatePCM } from "./sintez.js";

const atom = (name) => Symbol.for(name.trim());

const tokenize = (input) => {
  const graphemes = Array.from(input.trim());

  const loop = (scope, [currentChar, ...restChars], tokenBuffer = "") => {
    const [currentScope, parentScope, ...outerScopes] = scope;

    const typeify = (token) => {
      const parsedInt = Number.parseFloat(token, 10);
      return Number.isNaN(parsedInt) ? atom(token) : parsedInt;
    };

    if (!currentChar) {
      return tokenBuffer.length > 0
        ? [...currentScope, typeify(tokenBuffer)]
        : currentScope;
    }

    switch (currentChar) {
      case "(": {
        const updatedCurrentScope =
          tokenBuffer.length > 0
            ? [...currentScope, typeify(tokenBuffer)]
            : currentScope;

        const newScope = parentScope
          ? [[], updatedCurrentScope, parentScope, ...outerScopes]
          : [[], updatedCurrentScope, ...outerScopes];

        return loop(newScope, restChars);
      }
      case ")": {
        const updatedCurrentScope =
          tokenBuffer.length > 0
            ? [...currentScope, typeify(tokenBuffer)]
            : currentScope;

        const inner = parentScope
          ? [...parentScope, updatedCurrentScope]
          : updatedCurrentScope;

        return loop([inner, ...outerScopes], restChars, "");
      }
      case ";": {
        const lineEndIdx = restChars.indexOf("\n");

        if (lineEndIdx == -1) return loop(scope, [], tokenBuffer);
        else return loop(scope, restChars.slice(lineEndIdx + 1), tokenBuffer);
      }
      case " ":
      case "\t":
      case "\r":
      case "\n": {
        const updatedCurrentScope =
          tokenBuffer.length > 0
            ? [...currentScope, typeify(tokenBuffer)]
            : currentScope;

        return loop(
          [updatedCurrentScope, parentScope, ...outerScopes],
          restChars
        );
      }
      default:
        return loop(scope, restChars, tokenBuffer + currentChar);
    }
  };

  return loop([[]], graphemes);
};

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

const evaluateNode = (expression, fullPCM, symbolTable) => {
  if (typeof expression === "symbol") {
    if (expression in symbolTable) return symbolTable[expression];
    else {
      console.error(
        `Shvi: Definition for ${Symbol.keyFor(expression[0])} not found`
      );
      return;
    }
  } else if (typeof expression === "number") return expression;

  if (expression[0] in builtinCommands) {
    const command = builtinCommands[expression[0]];
    if (
      command.minOperandCount != undefined &&
      expression.length - 1 < command.minOperandCount
    ) {
      console.error(
        `Shvi: ${expression[0].description} takes at least ${command.minOperandCount} operands`
      );
      return;
    }

    if (
      command.operandCount != undefined &&
      expression.length - 1 != command.operandCount
    ) {
      console.error(
        `Shvi: ${expression[0].description} takes ${command.operandCount} operands`
      );
      return;
    }

    return command.fn(expression, fullPCM, symbolTable);
  } else {
    if (expression[0] in symbolTable)
      evaluateNode(symbolTable[expression[0]], fullPCM, symbolTable);
    else {
      console.error(
        `Shvi: Definition for ${Symbol.keyFor(expression[0])} not found`
      );
      return;
    }
  }
};

const evaluate = (syntaxTree, symbolTable, fullPCM) => {
  syntaxTree.forEach((statement) =>
    evaluateNode(statement, fullPCM, symbolTable)
  );
};
