export { evaluate, evaluateNode, tokenize };
import { builtinCommands } from "./builtin_commands.js";
import { SymbolTable } from "./symbol_table.js";

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
    return symbolTable.getSymbol(expression);
  } else if (typeof expression === "number") return expression;
  else if (expression.isLambda) return expression;

  if (
    typeof expression[0] === "symbol" &&
    expression[0] in builtinCommands
  ) {
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
    const func = evaluateNode(expression[0], fullPCM, symbolTable, envelope);
    if (!func || !func.isLambda) {
      console.error(
        `Shvi: ${Symbol.keyFor(expression)} is not a command or a lambda`,
      );
      return;
    }

    const givenArguments = expression.slice(1);

    if (func.arguments.length != givenArguments.length) {
      console.error(
        `Shvi: expected ${func.arguments.length} arguments, got ${givenArguments.length}`,
      );
      return;
    }

    const keys = func.arguments;
    const values = givenArguments;

    const symbolTableUpdate = Object.fromEntries(
      keys.map((key, i) => [key, values[i]]),
    );

    const newSymbolTable = new SymbolTable(symbolTableUpdate, func.closure);

    return evaluateNode(func.root, fullPCM, newSymbolTable, envelope);
  }
};

const evaluate = (syntaxTree, symbolTable, fullPCM) => {
  syntaxTree.forEach((statement) =>
    evaluateNode(statement, fullPCM, symbolTable, [
      Symbol.for("sine"),
      50,
      0,
      50,
    ])
  );
};
