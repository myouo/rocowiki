// SPDX-License-Identifier: GPL-3.0-only
export type MathNode =
  | { kind: 'atom'; value: string }
  | { kind: 'binary'; operator: string; left: MathNode; right: MathNode }
  | { kind: 'negative'; value: MathNode }
  | { kind: 'group'; value: MathNode }
  | { kind: 'absolute'; value: MathNode }
  | { kind: 'function'; name: 'floor' | 'ceil' | 'min'; args: MathNode[] };

/** Parse display notation only. Never evaluate community expressions as code. */
export function parseFormula(expression: string): MathNode {
  const tokens = expression.replaceAll('−', '-').match(/floor|ceil|min|\d+(?:\.\d+)?%?|[+\-×*÷/(),|]|[^+\-×*÷/(),|\s]+/gu) || [];
  let offset = 0, depth = 0;
  const primary = (): MathNode => {
    if (++depth > 20) throw new Error('Formula nesting limit');
    const token = tokens[offset++];
    let result: MathNode;
    if (token === '(' || token === '|') {
      result = { kind: token === '(' ? 'group' : 'absolute', value: binary(0) };
      if (tokens[offset++] !== (token === '(' ? ')' : '|')) throw new Error('Unclosed formula group');
    } else if (['floor', 'ceil', 'min'].includes(token) && tokens[offset] === '(') {
      offset++;
      const args = [binary(0)];
      while (tokens[offset] === ',') { offset++; args.push(binary(0)); }
      if (tokens[offset++] !== ')' || args.length !== (token === 'min' ? 2 : 1)) throw new Error('Invalid formula function');
      result = { kind: 'function', name: token as 'floor' | 'ceil' | 'min', args };
    } else if (token === '-') result = { kind: 'negative', value: primary() };
    else if (!token || /[+×*÷/),]/u.test(token)) throw new Error('Invalid formula token');
    else result = { kind: 'atom', value: token };
    depth--; return result;
  };
  const precedence = (token: string | undefined) => token && ['×', '*', '÷', '/'].includes(token) ? 2 : token && ['+', '-'].includes(token) ? 1 : -1;
  const binary = (minimum: number): MathNode => {
    let left = primary();
    while (precedence(tokens[offset]) >= minimum) {
      const operator = tokens[offset++], priority = precedence(operator);
      left = { kind: 'binary', operator, left, right: binary(priority + 1) };
    }
    return left;
  };
  const result = binary(0);
  if (offset !== tokens.length) throw new Error('Unexpected formula text');
  return result;
}

export interface ReaderFormula { label: string; expression: string; scope: string; tree: MathNode; verbatim?: boolean }
export interface ReaderEffect { before: string; after: string; formula?: number }

const functionEnd = (text: string, start: number): number => {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')' && --depth === 0) return i + 1;
  }
  return text.length;
};

export function separateFormula(line: string, scope: string, formulas: ReaderFormula[]): ReaderEffect {
  const assignment = /([^。；，,=]+?)\s*=\s*/u.exec(line);
  const call = /(?:floor|ceil|min)\(/u.exec(line);
  let start = assignment ? assignment.index + assignment[0].length : call?.index;
  if (start === undefined) return { before: line, after: '' };
  const functionCall = /^(?:floor|ceil|min)\(/u.test(line.slice(start));
  // An assignment may continue after a function, e.g. ceil(value / 2) + 10.
  // Keep that whole expression in both the inline notation and its reference.
  const end = functionCall && !assignment ? functionEnd(line, start) : start + line.slice(start).search(/[。；，]/u);
  const finish = end < start ? line.length : end;
  const expression = line.slice(start, finish).trim();
  if (!/[+×*÷/]|floor|ceil|min/u.test(expression)) return { before: line, after: '' };
  let tree: MathNode;
  let verbatim = false;
  try { tree = parseFormula(expression); } catch { tree = { kind: 'atom', value: expression }; verbatim = true; }
  const suffix = line.slice(finish);
  const label = assignment ? assignment[1].trim() : /护盾/u.test(suffix) ? '新增护盾' : /固伤/u.test(suffix) ? '追加固伤' : /威力/u.test(suffix) ? '威力增量' : /物防/u.test(suffix) ? '物防降低级数' : '计算值';
  const formula = formulas.push({ label, expression, scope, tree, ...(verbatim ? { verbatim: true } : {}) }) - 1;
  return { before: assignment ? line.slice(0, assignment.index) + label + '：' : line.slice(0, start), after: line.slice(finish), formula };
}
