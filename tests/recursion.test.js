import { assertEquals } from "jsr:@std/assert";

Deno.test("Recursion", async (t) => {
  await t.step({
    name: "reverse capitalize a string",
    fn: () => {
      const reverseCapitalize = (str) => {
        const loop = ([currentChar, ...rest], acc) => {
          if (!currentChar) return acc.join("");

          if (currentChar >= "A" && currentChar <= "Z") {
            return loop(rest, [...acc, currentChar.toLowerCase()]);
          } else return loop(rest, [...acc, currentChar.toUpperCase()]);
        };

        return loop(str, "");
      };

      const result = reverseCapitalize("BetTeR SafE ThaN SoRry");
      assertEquals(result, "bETtEr sAFe tHAn sOrRY");
    },
  });

  await t.step({
    name: "find the maximum value in a list",
    fn: () => {
      const max = (numbers) => {
        const loop = ([currentNumber, ...rest], maxValue) => {
          if (!currentNumber) return maxValue;

          return loop(rest, Math.max(currentNumber, maxValue));
        };

        return loop(numbers, -Infinity);
      };

      const maxOfEmptyList = max([]);
      const maxOfSingletonList = max([2]);
      const maxOfList = max([2, 3, 1, 4]);

      assertEquals(maxOfEmptyList, -Infinity);
      assertEquals(maxOfSingletonList, 2);
      assertEquals(maxOfList, 4);
    },
  });

  await t.step({
    name: "remove substrings from a string",
    fn: () => {
      const strip = (restChars, substr, matchBuffer = "") => {
        if (restChars.length == 0) return matchBuffer;

        if (restChars.startsWith(substr)) {
          return strip(restChars.slice(substr.length), substr, matchBuffer);
        } else {
          return strip(restChars.slice(1), substr, matchBuffer + restChars[0]);
        }
      };

      const result = strip("Skies are grey in Greece", "re");
      assertEquals(result, "Skies a gy in Gece");
    },
  });
});
