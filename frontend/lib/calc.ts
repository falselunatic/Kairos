// Safe arithmetic evaluator for note lines: numbers, + - * / (), no eval().

type Token = { type: "num" | "op" | "lparen" | "rparen"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(\d+(?:\.\d+)?|[+\-*/()])\s*/g;
  let match: RegExpExecArray | null;
  let pos = 0;
  while (pos < expr.length) {
    re.lastIndex = pos;
    match = re.exec(expr);
    if (!match || match.index !== pos) return [];
    const value = match[1];
    if (/^\d/.test(value)) tokens.push({ type: "num", value });
    else if (value === "(") tokens.push({ type: "lparen", value });
    else if (value === ")") tokens.push({ type: "rparen", value });
    else tokens.push({ type: "op", value });
    pos = re.lastIndex;
  }
  return tokens;
}

class Parser {
  tokens: Token[];
  i = 0;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }
  peek() {
    return this.tokens[this.i];
  }
  next() {
    return this.tokens[this.i++];
  }
  parseExpr(): number {
    let value = this.parseTerm();
    while (this.peek() && this.peek().type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }
  parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek() && this.peek().type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const rhs = this.parseFactor();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  }
  parseFactor(): number {
    const tok = this.peek();
    if (!tok) throw new Error("unexpected end");
    if (tok.type === "op" && tok.value === "-") {
      this.next();
      return -this.parseFactor();
    }
    if (tok.type === "lparen") {
      this.next();
      const value = this.parseExpr();
      if (!this.peek() || this.peek().type !== "rparen") throw new Error("missing )");
      this.next();
      return value;
    }
    if (tok.type === "num") {
      this.next();
      return parseFloat(tok.value);
    }
    throw new Error("unexpected token");
  }
}

/** Returns the computed value if `line` is a pure arithmetic expression, else null. */
export function evalArithmeticLine(line: string): number | null {
  const trimmed = line.trim();
  if (!trimmed || !/[0-9]/.test(trimmed) || !/^[0-9+\-*/().\s]+$/.test(trimmed)) return null;
  if (!/[+\-*/]/.test(trimmed)) return null;
  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return null;
    const parser = new Parser(tokens);
    const value = parser.parseExpr();
    if (parser.i !== tokens.length) return null;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}
