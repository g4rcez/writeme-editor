function isUnicodeWhitespace(code: number): boolean {
  return (
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x0d ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

function isASCIIPunct(code: number): boolean {
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e)
  );
}

function scanDelims(
  text: string,
  pos: number,
): { can_open: boolean; can_close: boolean } {
  const marker = text.charCodeAt(pos);
  const max = text.length;

  let p = pos;
  while (p < max && text.charCodeAt(p) === marker) p++;

  const nextCode = p < max ? text.charCodeAt(p) : -1;
  const prevCode = pos > 0 ? text.charCodeAt(pos - 1) : -1;

  const nextIsWhitespace = nextCode === -1 || isUnicodeWhitespace(nextCode);
  const prevIsWhitespace = prevCode === -1 || isUnicodeWhitespace(prevCode);
  const nextIsPunct = nextCode !== -1 && isASCIIPunct(nextCode);
  const prevIsPunct = prevCode !== -1 && isASCIIPunct(prevCode);

  // CommonMark spec §6.1
  const leftFlanking =
    !nextIsWhitespace && (!nextIsPunct || prevIsWhitespace || prevIsPunct);
  const rightFlanking =
    !prevIsWhitespace && (!prevIsPunct || nextIsWhitespace || nextIsPunct);

  let can_open: boolean;
  let can_close: boolean;

  if (marker === 0x5f /* _ */) {
    can_open = leftFlanking && (!rightFlanking || prevIsPunct);
    can_close = rightFlanking && (!leftFlanking || nextIsPunct);
  } else {
    can_open = leftFlanking;
    can_close = rightFlanking;
  }

  return { can_open, can_close };
}

export function shiftDelim(
  text: string,
  delim: string,
  start: number,
  offset: number,
): string {
  let res = text.substring(0, start) + text.substring(start + delim.length);
  res =
    res.substring(0, start + offset) + delim + res.substring(start + offset);
  return res;
}

function trimStart(
  text: string,
  delim: string,
  from: number,
  to: number,
): { text: string; from: number; to: number } {
  let pos = from,
    res = text;
  while (pos < to) {
    if (scanDelims(res, pos).can_open) {
      break;
    }
    res = shiftDelim(res, delim, pos, 1);
    pos++;
  }
  return { text: res, from: pos, to };
}

function trimEnd(
  text: string,
  delim: string,
  from: number,
  to: number,
): { text: string; from: number; to: number } {
  let pos = to,
    res = text;
  while (pos > from) {
    if (scanDelims(res, pos).can_close) {
      break;
    }
    res = shiftDelim(res, delim, pos, -1);
    pos--;
  }
  return { text: res, from, to: pos };
}

export function trimInline(
  text: string,
  delim: string,
  from: number,
  to: number,
): string {
  let state = {
    text,
    from,
    to,
  };

  state = trimStart(state.text, delim, state.from, state.to);
  state = trimEnd(state.text, delim, state.from, state.to);

  if (state.to - state.from < delim.length + 1) {
    state.text =
      state.text.substring(0, state.from) +
      state.text.substring(state.to + delim.length);
  }

  return state.text;
}
