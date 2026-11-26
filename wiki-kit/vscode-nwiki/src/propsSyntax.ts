/** Pure props-block helpers (no vscode) — used by formatCore + componentProps. */

export interface PropInfo {
  name: string;
  optional: boolean;
}

/** Parse `props { name: required, age }` body (order preserved). */
export function parsePropsBody(body: string): PropInfo[] {
  const props: PropInfo[] = [];
  for (const raw of splitPropItems(body)) {
    const item = parsePropItem(raw);
    if (item) props.push(item);
  }
  return props;
}

function splitPropItems(inner: string): string[] {
  const items: string[] = [];
  let buf = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "," || ch === ";") {
      const t = buf.trim();
      if (t) items.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const t = buf.trim();
  if (t) items.push(t);
  return items;
}

function parsePropItem(raw: string): PropInfo | undefined {
  const m = /^([A-Za-z_][\w]*)\s*(?::\s*([A-Za-z_][\w]*)(\?)?)?$/.exec(
    raw.trim()
  );
  if (!m) return undefined;
  const name = m[1];
  const marker = m[2];
  if (!marker) {
    return { name, optional: true };
  }
  if (marker === "required" && !m[3]) {
    return { name, optional: false };
  }
  // Legacy / invalid — skip for IDE; parser diagnoses.
  return undefined;
}

/** Required entries first, then optional (stable within each group). */
export function sortPropsRequiredFirst(props: PropInfo[]): PropInfo[] {
  const required = props.filter((p) => !p.optional);
  const optional = props.filter((p) => p.optional);
  return [...required, ...optional];
}

export function formatPropItem(p: PropInfo): string {
  return p.optional ? p.name : `${p.name}: required`;
}
