/**
 * Syntax Highlighter for Code Block Primitive
 * Tokenizes code and provides color schemes for different languages
 */

export enum TokenType {
  Keyword = "keyword",
  String = "string",
  Number = "number",
  Comment = "comment",
  Function = "function",
  Operator = "operator",
  Punctuation = "punctuation",
  Variable = "variable",
  Type = "type",
  BuiltIn = "builtin",
  Plain = "plain",
}

export interface Token {
  type: TokenType;
  value: string;
}

// Language-specific keyword sets
const KEYWORDS: Record<string, Set<string>> = {
  javascript: new Set([
    "async", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
    "for", "function", "if", "import", "in", "instanceof", "let", "new", "return",
    "static", "super", "switch", "this", "throw", "try", "typeof", "var", "void",
    "while", "with", "yield",
  ]),
  typescript: new Set([
    "async", "await", "break", "case", "catch", "class", "const", "continue",
    "debugger", "default", "delete", "do", "else", "enum", "export", "extends",
    "finally", "for", "function", "if", "import", "in", "instanceof", "interface",
    "let", "new", "return", "static", "super", "switch", "this", "throw", "try",
    "type", "typeof", "var", "void", "while", "with", "yield", "public", "private",
    "protected", "readonly", "abstract", "as", "namespace", "declare",
  ]),
  python: new Set([
    "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
    "del", "elif", "else", "except", "False", "finally", "for", "from", "global",
    "if", "import", "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass",
    "raise", "return", "True", "try", "while", "with", "yield",
  ]),
  java: new Set([
    "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
    "class", "const", "continue", "default", "do", "double", "else", "enum",
    "extends", "final", "finally", "float", "for", "goto", "if", "implements",
    "import", "instanceof", "int", "interface", "long", "native", "new", "package",
    "private", "protected", "public", "return", "short", "static", "strictfp",
    "super", "switch", "synchronized", "this", "throw", "throws", "transient",
    "try", "void", "volatile", "while",
  ]),
  go: new Set([
    "break", "case", "chan", "const", "continue", "default", "defer", "else",
    "fallthrough", "for", "func", "go", "goto", "if", "import", "interface",
    "map", "package", "range", "return", "select", "struct", "switch", "type",
    "var",
  ]),
  rust: new Set([
    "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
    "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop",
    "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self",
    "static", "struct", "super", "trait", "true", "type", "unsafe", "use",
    "where", "while",
  ]),
  cpp: new Set([
    "alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch",
    "char", "class", "const", "constexpr", "continue", "decltype", "default",
    "delete", "do", "double", "else", "enum", "explicit", "export", "extern",
    "false", "float", "for", "friend", "goto", "if", "inline", "int", "long",
    "mutable", "namespace", "new", "nullptr", "operator", "or", "private",
    "protected", "public", "return", "short", "signed", "sizeof", "static",
    "struct", "switch", "template", "this", "throw", "true", "try", "typedef",
    "typeid", "typename", "union", "unsigned", "using", "virtual", "void",
    "volatile", "while",
  ]),
  c: new Set([
    "auto", "break", "case", "char", "const", "continue", "default", "do",
    "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline",
    "int", "long", "register", "return", "short", "signed", "sizeof", "static",
    "struct", "switch", "typedef", "union", "unsigned", "void", "volatile",
    "while",
  ]),
  php: new Set([
    "abstract", "and", "array", "as", "break", "callable", "case", "catch",
    "class", "clone", "const", "continue", "declare", "default", "die", "do",
    "echo", "else", "elseif", "empty", "enddeclare", "endfor", "endforeach",
    "endif", "endswitch", "endwhile", "eval", "exit", "extends", "final",
    "finally", "fn", "for", "foreach", "function", "global", "goto", "if",
    "implements", "include", "instanceof", "interface", "isset", "list",
    "namespace", "new", "or", "print", "private", "protected", "public", "require",
    "return", "static", "switch", "throw", "trait", "try", "unset", "use",
    "var", "while", "yield",
  ]),
  ruby: new Set([
    "alias", "and", "begin", "break", "case", "class", "def", "defined", "do",
    "else", "elsif", "end", "ensure", "false", "for", "if", "in", "module",
    "next", "nil", "not", "or", "redo", "rescue", "retry", "return", "self",
    "super", "then", "true", "undef", "unless", "until", "when", "while", "yield",
  ]),
  sql: new Set([
    "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
    "ALTER", "TABLE", "INDEX", "VIEW", "DATABASE", "SCHEMA", "JOIN", "INNER",
    "LEFT", "RIGHT", "FULL", "OUTER", "ON", "AS", "ORDER", "BY", "GROUP",
    "HAVING", "UNION", "ALL", "DISTINCT", "LIMIT", "OFFSET", "ASC", "DESC",
    "AND", "OR", "NOT", "IN", "EXISTS", "BETWEEN", "LIKE", "IS", "NULL",
    "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "UNIQUE", "CHECK",
    "DEFAULT", "AUTO_INCREMENT", "CASCADE", "SET", "VALUES", "INTO", "CASE",
    "WHEN", "THEN", "ELSE", "END", "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION",
    "GRANT", "REVOKE", "WITH", "RECURSIVE", "PARTITION", "OVER", "ROW_NUMBER",
    "RANK", "DENSE_RANK", "LEAD", "LAG", "FIRST_VALUE", "LAST_VALUE",
    // Lowercase variants (SQL is case-insensitive)
    "select", "from", "where", "insert", "update", "delete", "create", "drop",
    "alter", "table", "index", "view", "database", "schema", "join", "inner",
    "left", "right", "full", "outer", "on", "as", "order", "by", "group",
    "having", "union", "all", "distinct", "limit", "offset", "asc", "desc",
    "and", "or", "not", "in", "exists", "between", "like", "is", "null",
    "primary", "key", "foreign", "references", "constraint", "unique", "check",
    "default", "auto_increment", "cascade", "set", "values", "into", "case",
    "when", "then", "else", "end", "begin", "commit", "rollback", "transaction",
    "grant", "revoke", "with", "recursive", "partition", "over", "row_number",
    "rank", "dense_rank", "lead", "lag", "first_value", "last_value",
  ]),
};

// Built-in types and classes for different languages
const BUILTINS: Record<string, Set<string>> = {
  javascript: new Set([
    "Array", "Boolean", "Date", "Error", "Function", "Map", "Math", "Number",
    "Object", "Promise", "Proxy", "RegExp", "Set", "String", "Symbol",
    "console", "window", "document", "setTimeout", "setInterval", "parseInt",
    "parseFloat", "isNaN", "isFinite", "JSON", "undefined", "null", "Infinity",
    "NaN",
  ]),
  typescript: new Set([
    "Array", "Boolean", "Date", "Error", "Function", "Map", "Math", "Number",
    "Object", "Promise", "Proxy", "RegExp", "Set", "String", "Symbol",
    "console", "window", "document", "setTimeout", "setInterval", "parseInt",
    "parseFloat", "isNaN", "isFinite", "JSON", "undefined", "null", "Infinity",
    "NaN", "any", "unknown", "never", "string", "number", "boolean", "void",
  ]),
  python: new Set([
    "print", "len", "range", "str", "int", "float", "list", "dict", "tuple",
    "set", "bool", "bytes", "type", "object", "sum", "min", "max", "abs",
    "input", "open", "zip", "map", "filter", "enumerate", "sorted", "reversed",
    "Exception", "ValueError", "TypeError", "KeyError", "IndexError",
  ]),
  java: new Set([
    "String", "Integer", "Boolean", "Double", "Float", "Long", "Short", "Byte",
    "Character", "System", "Math", "Object", "Exception", "ArrayList", "HashMap",
    "List", "Map", "Set",
  ]),
  go: new Set([
    "make", "len", "cap", "append", "copy", "delete", "panic", "recover",
    "print", "println", "error", "string", "int", "int8", "int16", "int32",
    "int64", "uint", "uint8", "uint16", "uint32", "uint64", "float32", "float64",
    "bool", "byte", "rune", "complex64", "complex128",
  ]),
  rust: new Set([
    "Some", "None", "Ok", "Err", "Vec", "String", "Box", "Option", "Result",
    "i8", "i16", "i32", "i64", "i128", "u8", "u16", "u32", "u64", "u128", "f32",
    "f64", "bool", "char", "str", "println", "print", "panic", "assert",
  ]),
  sql: new Set([
    // Data types
    "INT", "INTEGER", "BIGINT", "SMALLINT", "TINYINT", "DECIMAL", "NUMERIC",
    "FLOAT", "REAL", "DOUBLE", "VARCHAR", "CHAR", "TEXT", "BLOB", "DATE",
    "DATETIME", "TIMESTAMP", "TIME", "BOOLEAN", "BOOL", "JSON", "UUID",
    // Aggregate functions
    "COUNT", "SUM", "AVG", "MIN", "MAX", "GROUP_CONCAT", "STRING_AGG",
    // String functions
    "CONCAT", "SUBSTRING", "UPPER", "LOWER", "TRIM", "LENGTH", "REPLACE",
    "COALESCE", "NULLIF", "CAST", "CONVERT",
    // Date functions
    "NOW", "CURRENT_TIMESTAMP", "CURRENT_DATE", "CURRENT_TIME", "DATE_ADD",
    "DATE_SUB", "DATEDIFF", "YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND",
    // Other functions
    "IFNULL", "IF", "ROW_NUMBER", "RANK", "DENSE_RANK", "LAG", "LEAD",
    // Lowercase variants
    "int", "integer", "bigint", "smallint", "tinyint", "decimal", "numeric",
    "float", "real", "double", "varchar", "char", "text", "blob", "date",
    "datetime", "timestamp", "time", "boolean", "bool", "json", "uuid",
    "count", "sum", "avg", "min", "max", "group_concat", "string_agg",
    "concat", "substring", "upper", "lower", "trim", "length", "replace",
    "coalesce", "nullif", "cast", "convert",
    "now", "current_timestamp", "current_date", "current_time", "date_add",
    "date_sub", "datediff", "year", "month", "day", "hour", "minute", "second",
    "ifnull", "if",
  ]),
};

/**
 * Normalize language identifier to a standard name
 */
function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  const aliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    cpp: "cpp",
    "c++": "cpp",
    golang: "go",
    rs: "rust",
  };
  return aliases[normalized] || normalized;
}

/**
 * Tokenize a line of code into syntax-highlighted tokens
 */
export function tokenizeLine(line: string, language: string): Token[] {
  const lang = normalizeLanguage(language);
  const keywords = KEYWORDS[lang] || KEYWORDS.javascript;
  const builtins = BUILTINS[lang] || BUILTINS.javascript;
  const tokens: Token[] = [];

  // Handle empty lines
  if (!line || line.trim() === "") {
    return [{ type: TokenType.Plain, value: line }];
  }

  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const rest = line.slice(i);

    // Comments - language specific
    if (
      (lang === "javascript" || lang === "typescript" || lang === "java" || lang === "go" || lang === "rust" || lang === "cpp" || lang === "c") &&
      rest.startsWith("//")
    ) {
      tokens.push({ type: TokenType.Comment, value: line.slice(i) });
      break;
    }

    // SQL single-line comments (-- style)
    if (lang === "sql" && rest.startsWith("--")) {
      tokens.push({ type: TokenType.Comment, value: line.slice(i) });
      break;
    }

    if (
      (lang === "javascript" || lang === "typescript" || lang === "java" || lang === "cpp" || lang === "c" || lang === "sql") &&
      rest.startsWith("/*")
    ) {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        tokens.push({ type: TokenType.Comment, value: line.slice(i) });
        break;
      } else {
        tokens.push({ type: TokenType.Comment, value: line.slice(i, end + 2) });
        i = end + 2;
        continue;
      }
    }

    if ((lang === "python" || lang === "ruby") && char === "#") {
      tokens.push({ type: TokenType.Comment, value: line.slice(i) });
      break;
    }

    // Strings - single and double quotes
    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      let j = i + 1;
      let escaped = false;

      while (j < line.length) {
        if (escaped) {
          escaped = false;
          j++;
          continue;
        }
        if (line[j] === "\\") {
          escaped = true;
          j++;
          continue;
        }
        if (line[j] === quote) {
          j++;
          break;
        }
        j++;
      }

      tokens.push({ type: TokenType.String, value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(char)) {
      let j = i;
      while (j < line.length && /[\d._xXoObB]/.test(line[j])) {
        j++;
      }
      tokens.push({ type: TokenType.Number, value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) {
        j++;
      }
      const word = line.slice(i, j);

      // Check if it's a function call (followed by '(')
      const nextNonSpace = line.slice(j).match(/^\s*\(/);
      if (nextNonSpace) {
        tokens.push({ type: TokenType.Function, value: word });
      } else if (keywords.has(word)) {
        tokens.push({ type: TokenType.Keyword, value: word });
      } else if (builtins.has(word)) {
        tokens.push({ type: TokenType.BuiltIn, value: word });
      } else if (/^[A-Z]/.test(word)) {
        // Capitalized words are likely types/classes
        tokens.push({ type: TokenType.Type, value: word });
      } else {
        tokens.push({ type: TokenType.Variable, value: word });
      }

      i = j;
      continue;
    }

    // Operators
    if (
      /[+\-*/%=<>!&|^~?:]/.test(char) ||
      rest.startsWith("&&") ||
      rest.startsWith("||") ||
      rest.startsWith("==") ||
      rest.startsWith("!=") ||
      rest.startsWith("<=") ||
      rest.startsWith(">=") ||
      rest.startsWith("=>") ||
      rest.startsWith("->") ||
      rest.startsWith("<<") ||
      rest.startsWith(">>") ||
      rest.startsWith("++") ||
      rest.startsWith("--")
    ) {
      let j = i;
      while (j < line.length && /[+\-*/%=<>!&|^~?:]/.test(line[j])) {
        j++;
      }
      tokens.push({ type: TokenType.Operator, value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Punctuation
    if (/[(){}\[\];,.]/.test(char)) {
      tokens.push({ type: TokenType.Punctuation, value: char });
      i++;
      continue;
    }

    // Whitespace and other characters
    let j = i;
    while (j < line.length && /\s/.test(line[j])) {
      j++;
    }
    if (j > i) {
      tokens.push({ type: TokenType.Plain, value: line.slice(i, j) });
      i = j;
      continue;
    }

    // Default: treat as plain text
    tokens.push({ type: TokenType.Plain, value: char });
    i++;
  }

  return tokens;
}

/**
 * Get color for a token type based on theme
 */
export function getTokenColor(
  tokenType: TokenType,
  darkTheme: boolean
): string {
  if (darkTheme) {
    switch (tokenType) {
      case TokenType.Keyword:
        return "#C084FC"; // Purple
      case TokenType.String:
        return "#86EFAC"; // Green
      case TokenType.Number:
        return "#FDBA74"; // Orange
      case TokenType.Comment:
        return "#64748B"; // Gray
      case TokenType.Function:
        return "#60A5FA"; // Blue
      case TokenType.Operator:
        return "#FB923C"; // Orange
      case TokenType.Punctuation:
        return "#94A3B8"; // Light gray
      case TokenType.Type:
        return "#34D399"; // Emerald
      case TokenType.BuiltIn:
        return "#FCD34D"; // Yellow
      case TokenType.Variable:
        return "#E2E8F0"; // Off-white
      case TokenType.Plain:
      default:
        return "#E2E8F0"; // Off-white
    }
  } else {
    switch (tokenType) {
      case TokenType.Keyword:
        return "#7C3AED"; // Purple
      case TokenType.String:
        return "#15803D"; // Green
      case TokenType.Number:
        return "#EA580C"; // Orange
      case TokenType.Comment:
        return "#64748B"; // Gray
      case TokenType.Function:
        return "#2563EB"; // Blue
      case TokenType.Operator:
        return "#C2410C"; // Dark orange
      case TokenType.Punctuation:
        return "#475569"; // Dark gray
      case TokenType.Type:
        return "#059669"; // Emerald
      case TokenType.BuiltIn:
        return "#CA8A04"; // Yellow/gold
      case TokenType.Variable:
        return "#0F172A"; // Dark slate
      case TokenType.Plain:
      default:
        return "#0F172A"; // Dark slate
    }
  }
}
