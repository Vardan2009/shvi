export { evaluate, evaluateNode, tokenize };
import { builtinCommands } from "./builtin_commands.js";

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
        const updatedCurrentScope = tokenBuffer.length > 0
          ? [...currentScope, typeify(tokenBuffer)]
          : currentScope;

        const newScope = parentScope
          ? [[], updatedCurrentScope, parentScope, ...outerScopes]
          : [[], updatedCurrentScope, ...outerScopes];

        return loop(newScope, restChars);
      }
      case ")": {
        const updatedCurrentScope = tokenBuffer.length > 0
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
        const updatedCurrentScope = tokenBuffer.length > 0
          ? [...currentScope, typeify(tokenBuffer)]
          : currentScope;

        return loop(
          [updatedCurrentScope, parentScope, ...outerScopes],
          restChars,
        );
      }
      default:
        return loop(scope, restChars, tokenBuffer + currentChar);
    }
  };

  return loop([[]], graphemes);
};

const evaluateNode = (
  expression,
  fullPCM,
  symbolTable,
  envelope = undefined,
) => {
  if (typeof expression === "symbol") {
    if (expression in symbolTable) return symbolTable[expression];
    else {
      console.error(
        `Shvi: Definition for ${Symbol.keyFor(expression[0])} not found`,
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
        `Shvi: ${
          expression[0].description
        } takes at least ${command.minOperandCount} operands`,
      );
      return;
    }

    if (
      command.operandCount != undefined &&
      expression.length - 1 != command.operandCount
    ) {
      console.error(
        `Shvi: ${
          expression[0].description
        } takes ${command.operandCount} operands`,
      );
      return;
    }

    return command.fn(expression, fullPCM, symbolTable, envelope);
  } else {
    if (expression[0] in symbolTable) {
      return evaluateNode(
        symbolTable[expression[0]],
        fullPCM,
        symbolTable,
        envelope,
      );
    } else {
      console.error(
        `Shvi: Definition for ${Symbol.keyFor(expression[0])} not found`,
      );
      return;
    }
  }
};

const evaluate = (syntaxTree, symbolTable, fullPCM) => {
  syntaxTree.forEach((statement) =>
    evaluateNode(statement, fullPCM, symbolTable, [50, 0, 50])
  );
};
