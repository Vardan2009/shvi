export { tokenize, evaluate };
import { generatePCM } from "./sintez.js";

const atom = (name) => Symbol.for(name.trim());

const typeify = (token) => {
  if (!isNaN(parseFloat(token))) return parseFloat(token);
  else return atom(token);
};

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

const evaluateNode = (expression, fullPCM, symbolTable) => {
  if (typeof expression === "symbol") {
    if (expression in symbolTable) return symbolTable[expression];
    else {
      console.error(`Shvi: Definition for ${expression.toString()} not found`);
      return;
    }
  } else if (typeof expression === "number") return expression;

  switch (expression[0]) {
    case Symbol.for("add"): {
      let sum = 0;
      for (let i = 1; i < expression.length; ++i)
        sum += evaluateNode(expression[i], fullPCM, symbolTable);
      return sum;
    }
    case Symbol.for("sub"): {
      let diff = evaluateNode(expression[1]);
      for (let i = 2; i < expression.length; ++i)
        diff += evaluateNode(expression[i], fullPCM, symbolTable);
      return diff;
    }
    case Symbol.for("mul"): {
      let factor = 0;
      for (let i = 1; i < expression.length; ++i)
        factor *= evaluateNode(expression[i], fullPCM, symbolTable);
      return factor;
    }
    case Symbol.for("div"): {
      let quotient = evaluateNode(expression[1], fullPCM, symbolTable);
      for (let i = 2; i < expression.length; ++i)
        quotient /= evaluateNode(expression[i], fullPCM, symbolTable);
      return quotient;
    }
    case Symbol.for("tone"): {
      fullPCM.push(
        ...generatePCM(
          evaluateNode(expression[1], fullPCM, symbolTable),
          evaluateNode(expression[2], fullPCM, symbolTable)
        )
      );
      return undefined;
    }
    case Symbol.for("define"): {
      symbolTable[expression[1]] = expression[2];
      return undefined;
    }
    case Symbol.for("print"): {
      console.log(
        ...expression.slice(1).map((n) => evaluateNode(n, fullPCM, symbolTable))
      );
      return undefined;
    }
    case Symbol.for("silence"): {
      fullPCM.push(
        ...generatePCM(0, evaluateNode(expression[1], fullPCM, symbolTable))
      );
      return undefined;
    }
    case Symbol.for("repeat"): {
      const times = evaluateNode(expression[1], fullPCM, symbolTable);
      for (let i = 0; i < times; ++i)
        evaluateNode(expression[2], fullPCM, symbolTable);
      return undefined;
    }
    case Symbol.for("sequence"): {
      for (let i = 1; i < expression.length; ++i)
        evaluateNode(expression[i], fullPCM, symbolTable);
      return undefined;
    }
    default:
      if (expression[0] in symbolTable)
        evaluateNode(symbolTable[expression[0]], fullPCM, symbolTable);
      else {
        console.error(
          `Shvi: Definition for ${expression.toString()} not found`
        );
        return;
      }
      break;
  }
};

const evaluate = (syntaxTree, symbolTable, fullPCM) => {
  syntaxTree.forEach((statement) =>
    evaluateNode(statement, fullPCM, symbolTable)
  );
};
