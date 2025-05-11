export { encodeWAV, evaluate, generatePCM, tokenize, typeify };

// sample[n]= A ⋅ sin(2 * π * f * (n / R))

// Where:
//   A: Amplitude (max value based on bit depth, e.g., 32767 for 16-bit)
//   f: Frequency (Hz), e.g., middle C = 261.63 Hz
//   R: Sample rate (samples per second), typically 44100 Hz
//   n: Sample number (integer), from 0 to R × duration − 1

function generatePCM(frequency, duration) {
  const amplitude = 32767;
  const sampleRate = 44100;

  const numSamples = Math.floor(sampleRate * (duration / 1000));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = amplitude * Math.sin(2 * Math.PI * frequency * t);
    samples.push(sample);
  }

  return samples;
}

async function encodeWAV(samples, output = "output.wav", sampleRate = 44100) {
  const headerSize = 44;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }

  await Deno.writeFile(output, new Uint8Array(buffer));
}

const atom = (name) => Symbol.for(name);

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
  if (typeof expression === "symbol") return symbolTable[expression];
  else if (typeof expression === "number") return expression;

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
      const value = evaluateNode(expression[2], fullPCM, symbolTable);
      symbolTable[expression[1]] = value;
      return value;
    }
    case Symbol.for("print"): {
      console.log(
        ...expression.slice(1).map((n) => evaluateNode(n, fullPCM, symbolTable))
      );
      return undefined;
    }
  }
};

const evaluate = (syntaxTree, symbolTable) => {
  const fullPCM = [];
  syntaxTree.forEach((statement) =>
    evaluateNode(statement, fullPCM, symbolTable)
  );
  return fullPCM;
};
