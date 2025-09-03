export const shikiMathGrammer = {
  name: "math",
  scopeName: "source.math",
  displayName: "Math",
  fileTypes: ["math", "expr"],
  patterns: [
    {
      include: "#expression",
    },
  ],
  repository: {
    expression: {
      patterns: [
        { include: "#comment" },
        { include: "#function" },
        { include: "#number" },
        { include: "#constant" },
        { include: "#variable" },
        { include: "#string" },
        { include: "#logical-operators" },
        { include: "#comparison-operators" },
        { include: "#arithmetic-operators" },
        { include: "#set-operators" },
        { include: "#calculus-operators" },
        { include: "#brackets" },
        { include: "#special-symbols" },
      ],
    },
    comment: {
      patterns: [
        {
          name: "comment.line.double-slash.math",
          match: "//.*$",
        },
        {
          name: "comment.block.math",
          begin: "/\\*",
          end: "\\*/",
        },
      ],
    },
    function: {
      patterns: [
        {
          name: "support.function.trigonometric.math",
          match:
            "\\b(sin|cos|tan|cot|sec|csc|asin|acos|atan|atan2|acot|asec|acsc|sinh|cosh|tanh|coth|sech|csch|asinh|acosh|atanh|acoth|asech|acsch)\\b",
        },
        {
          name: "support.function.logarithmic.math",
          match: "\\b(log|ln|log2|log10|exp|exp2|exp10)\\b",
        },
        {
          name: "support.function.root.math",
          match: "\\b(sqrt|cbrt|root)\\b",
        },
        {
          name: "support.function.statistical.math",
          match:
            "\\b(sum|prod|mean|median|mode|var|std|cov|corr|min|max|avg)\\b",
        },
        {
          name: "support.function.calculus.math",
          match: "\\b(lim|int|diff|grad|div|curl|laplacian)\\b",
        },
        {
          name: "support.function.combinatorial.math",
          match: "\\b(factorial|permutation|combination|binomial)\\b",
        },
        {
          name: "support.function.rounding.math",
          match: "\\b(floor|ceil|round|trunc|abs|sign|sgn)\\b",
        },
        {
          name: "support.function.complex.math",
          match: "\\b(real|imag|conj|arg|magnitude|phase)\\b",
        },
        {
          name: "support.function.matrix.math",
          match: "\\b(det|trace|rank|inv|transpose|eigenvalue|eigenvector)\\b",
        },
        {
          name: "support.function.special.math",
          match: "\\b(gamma|beta|erf|erfc|bessel|legendre|hermite|laguerre)\\b",
        },
      ],
    },
    number: {
      patterns: [
        {
          name: "constant.numeric.binary.math",
          match: "0b[01]+(_[01]+)*",
        },
        {
          name: "constant.numeric.octal.math",
          match: "0o[0-7]+(_[0-7]+)*",
        },
        {
          name: "constant.numeric.hex.math",
          match: "0x[0-9a-fA-F]+(_[0-9a-fA-F]+)*",
        },
        {
          name: "constant.numeric.complex.math",
          match: "\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?[ij]\\b",
        },
        {
          name: "constant.numeric.float.math",
          match: "\\b\\d+\\.\\d+([eE][+-]?\\d+)?\\b",
        },
        {
          name: "constant.numeric.scientific.math",
          match: "\\b\\d+([eE][+-]?\\d+)\\b",
        },
        {
          name: "constant.numeric.integer.math",
          match: "\\b\\d+\\b",
        },
        {
          name: "constant.numeric.variables.greek",
          match: "\\b[αβγδεζηθικλμνξοπρσςτυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]\\b",
        },
      ],
    },
    constant: {
      patterns: [
        {
          name: "constant.language.mathematical.math",
          match: "\\b(pi|π|e|phi|φ|tau|τ|euler|golden)\\b",
        },
        {
          name: "constant.language.infinity.math",
          match: "\\b(inf|infinity|∞)\\b",
        },
        {
          name: "constant.language.nan.math",
          match: "\\b(nan|NaN)\\b",
        },
        {
          name: "constant.language.boolean.math",
          match: "\\b(true|false)\\b",
        },
      ],
    },
    variable: {
      patterns: [
        {
          name: "variable.other.greek.math",
          match: "[αβγδεζηθικλμνξοπρσςτυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]",
        },
        {
          name: "variable.other.subscript.math",
          match: "[a-zA-Z]\\w*_\\w+",
        },
        {
          name: "variable.other.math",
          match: "[a-zA-Z]\\w*",
        },
      ],
    },
    string: {
      patterns: [
        {
          name: "string.quoted.double.math",
          begin: '"',
          end: '"',
          patterns: [
            {
              name: "constant.character.escape.math",
              match: "\\\\.",
            },
          ],
        },
        {
          name: "string.quoted.single.math",
          begin: "'",
          end: "'",
          patterns: [
            {
              name: "constant.character.escape.math",
              match: "\\\\.",
            },
          ],
        },
      ],
    },
    "logical-operators": {
      patterns: [
        {
          name: "keyword.operator.logical.and.math",
          match: "&&|∧|\\band\\b",
        },
        {
          name: "keyword.operator.logical.or.math",
          match: "\\|\\||∨|\\bor\\b",
        },
        {
          name: "keyword.operator.logical.not.math",
          match: "!|¬|\\bnot\\b",
        },
        {
          name: "keyword.operator.logical.xor.math",
          match: "⊕|\\bxor\\b",
        },
        {
          name: "keyword.operator.logical.implies.math",
          match: "=>|⇒|→",
        },
        {
          name: "keyword.operator.logical.iff.math",
          match: "<=>|⇔|↔",
        },
        {
          name: "keyword.operator.quantifier.math",
          match: "∀|∃|∄",
        },
      ],
    },
    "comparison-operators": {
      patterns: [
        {
          name: "keyword.operator.comparison.equal.math",
          match: "==|=",
        },
        {
          name: "keyword.operator.comparison.not-equal.math",
          match: "!=|≠|<>",
        },
        {
          name: "keyword.operator.comparison.less-than.math",
          match: "<=|≤|<",
        },
        {
          name: "keyword.operator.comparison.greater-than.math",
          match: ">=|≥|>",
        },
        {
          name: "keyword.operator.comparison.approximately.math",
          match: "≈|≅|≃|∼",
        },
        {
          name: "keyword.operator.comparison.congruent.math",
          match: "≡",
        },
        {
          name: "keyword.operator.comparison.proportional.math",
          match: "∝",
        },
      ],
    },
    "arithmetic-operators": {
      patterns: [
        {
          name: "keyword.operator.arithmetic.plus.math",
          match: "\\+|⊕",
        },
        {
          name: "keyword.operator.arithmetic.minus.math",
          match: "-|−|⊖",
        },
        {
          name: "keyword.operator.arithmetic.multiply.math",
          match: "\\*|×|·|⊗",
        },
        {
          name: "keyword.operator.arithmetic.divide.math",
          match: "/|÷|⊘",
        },
        {
          name: "keyword.operator.arithmetic.modulo.math",
          match: "%|\\bmod\\b",
        },
        {
          name: "keyword.operator.arithmetic.power.math",
          match: "\\^|\\*\\*",
        },
        {
          name: "keyword.operator.arithmetic.factorial.math",
          match: "!",
        },
        {
          name: "keyword.operator.arithmetic.plusminus.math",
          match: "±|∓",
        },
        {
          name: "keyword.operator.arithmetic.dot-product.math",
          match: "⋅",
        },
        {
          name: "keyword.operator.arithmetic.cross-product.math",
          match: "⨯",
        },
        {
          name: "keyword.operator.arithmetic.tensor-product.math",
          match: "⊗",
        },
      ],
    },
    "set-operators": {
      patterns: [
        {
          name: "keyword.operator.set.membership.math",
          match: "∈|∉|∋|∌",
        },
        {
          name: "keyword.operator.set.subset.math",
          match: "⊂|⊃|⊆|⊇|⊊|⊋",
        },
        {
          name: "keyword.operator.set.union.math",
          match: "∪|⋃",
        },
        {
          name: "keyword.operator.set.intersection.math",
          match: "∩|⋂",
        },
        {
          name: "keyword.operator.set.difference.math",
          match: "∖|−",
        },
        {
          name: "keyword.operator.set.symmetric-difference.math",
          match: "△|⊕",
        },
        {
          name: "keyword.operator.set.empty.math",
          match: "∅|⌀",
        },
      ],
    },
    "calculus-operators": {
      patterns: [
        {
          name: "keyword.operator.calculus.integral.math",
          match: "∫|∬|∭|∮|∯|∰|∱|∲|∳",
        },
        {
          name: "keyword.operator.calculus.partial.math",
          match: "∂",
        },
        {
          name: "keyword.operator.calculus.nabla.math",
          match: "∇",
        },
        {
          name: "keyword.operator.calculus.differential.math",
          match: "d/d[a-zA-Z]|∆",
        },
        {
          name: "keyword.operator.calculus.summation.math",
          match: "∑|Σ",
        },
        {
          name: "keyword.operator.calculus.product.math",
          match: "∏|Π",
        },
        {
          name: "keyword.operator.calculus.limit.math",
          match: "lim",
        },
      ],
    },
    brackets: {
      patterns: [
        {
          name: "punctuation.bracket.round.math",
          match: "[()]",
        },
        {
          name: "punctuation.bracket.square.math",
          match: "[\\[\\]]",
        },
        {
          name: "punctuation.bracket.curly.math",
          match: "[{}]",
        },
        {
          name: "punctuation.bracket.angle.math",
          match: "[⟨⟩⌈⌉⌊⌋]|<|>",
        },
        {
          name: "punctuation.bracket.absolute.math",
          match: "\\|",
        },
        {
          name: "punctuation.bracket.norm.math",
          match: "‖",
        },
      ],
    },
    "special-symbols": {
      patterns: [
        {
          name: "punctuation.separator.comma.math",
          match: ",",
        },
        {
          name: "punctuation.separator.semicolon.math",
          match: ";",
        },
        {
          name: "punctuation.separator.colon.math",
          match: ":",
        },
        {
          name: "punctuation.terminator.statement.math",
          match: "\\.",
        },
        {
          name: "keyword.operator.assignment.math",
          match: ":=|←|⇐",
        },
        {
          name: "keyword.operator.definition.math",
          match: "≔|≕",
        },
        {
          name: "keyword.operator.therefore.math",
          match: "∴",
        },
        {
          name: "keyword.operator.because.math",
          match: "∵",
        },
        {
          name: "keyword.operator.qed.math",
          match: "∎|□|■",
        },
        {
          name: "keyword.operator.ellipsis.math",
          match: "\\.\\.\\.|…|⋯|⋮|⋱",
        },
      ],
    },
  },
};
