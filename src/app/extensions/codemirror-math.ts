import { StreamLanguage } from "@codemirror/language";

export const mathLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    
    // Comments
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    // Strings (double quoted)
    if (stream.match('"')) {
      while (!stream.eol()) {
        if (stream.next() === '"') break;
      }
      return "string";
    }

    // Units and specific keywords from math-block.tsx logic
    if (stream.match(/\b(inches|celsius|fahrenheit|kelvin|percent|to|of)\b/i)) {
      return "unit";
    }

    // Numbers
    if (stream.match(/^[\d.,]+/)) {
      return "number";
    }

    // Operators
    if (stream.match(/^[+\-*/^=<>!%()]+/)) {
      return "operator";
    }

    // Standard Math Functions & Constants
    if (stream.match(/^(sin|cos|tan|asin|acos|atan|log|ln|sqrt|abs|round|ceil|floor|pi|e)\b/)) {
      return "keyword";
    }

    // Variables / Text
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
      return "variableName";
    }

    stream.next();
    return null;
  }
});
