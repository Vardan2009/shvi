export { evaluate, evaluateNode, isFalsy, lispCompare, lispPrint, tokenize };
import { builtinCommands } from "./builtin_commands.js";
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

const toLispPrintable = (val) => {
  if (val === true) return "T";
  if (isFalsy(val)) return "NIL";
  if (Array.isArray(val)) {
    let str = "(";
    val.forEach((v, i) =>
      str += toLispPrintable(v) +
        ((i != val.length - 1) ? " " : "")
    );
    str += ")";
    return str;
  }
  if (typeof val === "symbol") return Symbol.keyFor(val);
  return val;
};

const lispPrint = (...vals) => {
  console.log(...vals.map(toLispPrintable));
};

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
      const result = deSugar(
        tokenBuffer.length > 0
          ? [...currentScope, typeify(tokenBuffer)]
          : currentScope,
      );

      return result;
    }

    switch (currentChar) {
      case "'": {
        const updatedCurrentScope = tokenBuffer.length > 0
          ? [...currentScope, typeify(tokenBuffer), atom("'")]
          : [...currentScope, atom("'")];

        return loop(
          [updatedCurrentScope, parentScope, ...outerScopes],
          restChars,
        );
      }
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

const deSugar = (tokens) => {
  const newTokens = [];

  for (let i = 0; i < tokens.length; ++i) {
    if (typeof tokens[i] === "symbol" && tokens[i] == atom("'")) {
      newTokens.push([atom("quote"), tokens[++i]]);
    } else if (Array.isArray(tokens[i])) {
      newTokens.push(deSugar(tokens[i]));
    } else {
      newTokens.push(tokens[i]);
    }
  }

  return newTokens;
};

const evaluateNode = (
  expression,
  fullPCM,
  symbolTable,
  envelope = undefined,
  modifiers = {},
) => {
  if (typeof expression === "symbol") {
    switch (expression) {
      case Symbol.for("t"):
        return true;
      case Symbol.for("nil"):
        return Symbol.for("nil");
      default:
        return symbolTable.getSymbol(expression);
    }
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

    return command.fn(expression, fullPCM, symbolTable, envelope, modifiers);
  } else {
    const func = evaluateNode(
      expression[0],
      fullPCM,
      symbolTable,
      envelope,
      modifiers,
    );
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
      keys.map((
        key,
        i,
      ) => [
        key,
        evaluateNode(values[i], fullPCM, symbolTable, envelope, modifiers),
      ]),
    );

    const newSymbolTable = new SymbolTable(symbolTableUpdate, func.closure);

    return evaluateNode(
      func.root,
      fullPCM,
      newSymbolTable,
      envelope,
      modifiers,
    );
  }
};

const evaluate = (syntaxTree, symbolTable, fullPCM) => {
  let result;
  syntaxTree.forEach((statement) =>
    result = evaluateNode(statement, fullPCM, symbolTable, [
      Symbol.for("sine"),
      50,
      0,
      50,
    ], {})
  );

  return result;
};
