/** Known nwiki tags and attributes (SPEC / ProfileTable). */

export const TAGS = [
  "Table",
  "TableRow",
  "TableColumn",
  "Text",
  "TitleText",
  "Image",
  "Link",
  "Comment",
  "Space",
  "br",
  "Box",
  "Row",
  "Column",
  "Folding",
  "Heading",
  "Quote",
  "Badge",
  "script",
  "template",
] as const;

export type TagName = (typeof TAGS)[number];

export type AttrReq =
  | { kind: "required" }
  | { kind: "optional" }
  /** Exactly one of the group when required (default). At most one when required: false. */
  | { kind: "oneOf"; group: string; required?: boolean };

/** Machine source of truth for required / optional / XOR attributes. */
export const TAG_ATTR_SPEC: Record<string, Record<string, AttrReq>> = {
  Table: {
    width: { kind: "optional" },
    align: { kind: "optional" },
    borderColor: { kind: "optional" },
    bgColor: { kind: "optional" },
  },
  TableRow: {
    alignment: { kind: "optional" },
  },
  TableColumn: {
    width: { kind: "optional" },
    bgColor: { kind: "optional" },
    alignment: { kind: "optional" },
    delimiter: { kind: "optional" },
    colSpan: { kind: "optional" },
    nopad: { kind: "optional" },
  },
  Text: {
    text: { kind: "required" },
    size: { kind: "optional" },
    color: { kind: "optional" },
    weight: { kind: "optional" },
    decoration: { kind: "optional" },
    alignment: { kind: "optional" },
  },
  TitleText: {
    text: { kind: "required" },
  },
  Image: {
    fileName: { kind: "oneOf", group: "imageSrc" },
    src: { kind: "oneOf", group: "imageSrc" },
    width: { kind: "optional" },
    height: { kind: "optional" },
  },
  Link: {
    toDocument: { kind: "oneOf", group: "linkTarget" },
    toExternal: { kind: "oneOf", group: "linkTarget" },
    label: { kind: "optional" },
  },
  Comment: {
    text: { kind: "optional" },
  },
  Space: {},
  br: {},
  Box: Object.fromEntries(
    [
      "width",
      "maxWidth",
      "minWidth",
      "height",
      "margin",
      "padding",
      "border",
      "borderTop",
      "borderRight",
      "borderBottom",
      "borderLeft",
      "borderRadius",
      "bgColor",
      "background",
      "color",
      "opacity",
      "display",
      "alignItems",
      "justifyContent",
      "flexDirection",
      "textAlign",
      "wordBreak",
      "fontSize",
      "fontFamily",
      "styleExtra",
    ].map((a) => [a, { kind: "optional" as const }])
  ),
  Row: Object.fromEntries(
    [
      "crossAxisAlignment",
      "mainAxisAlignment",
      "spacing",
      "inline",
      "width",
      "maxWidth",
      "minWidth",
      "height",
      "margin",
      "padding",
      "bgColor",
      "color",
      "textAlign",
      "styleExtra",
    ].map((a) => [a, { kind: "optional" as const }])
  ),
  Column: Object.fromEntries(
    [
      "crossAxisAlignment",
      "mainAxisAlignment",
      "spacing",
      "width",
      "maxWidth",
      "minWidth",
      "height",
      "margin",
      "padding",
      "bgColor",
      "color",
      "textAlign",
      "styleExtra",
    ].map((a) => [a, { kind: "optional" as const }])
  ),
  Folding: {
    title: { kind: "required" },
  },
  Heading: {
    title: { kind: "required" },
    collapsed: { kind: "optional" },
    toDocument: { kind: "oneOf", group: "linkTarget", required: false },
    toExternal: { kind: "oneOf", group: "linkTarget", required: false },
  },
  Quote: {},
  Badge: {
    bgColor: { kind: "optional" },
    borderRadius: { kind: "optional" },
    padding: { kind: "optional" },
    color: { kind: "optional" },
  },
  script: {},
  template: {},
};

/** Attribute names per tag (required → oneOf → optional order). */
export const TAG_ATTRS: Record<string, string[]> = Object.fromEntries(
  Object.entries(TAG_ATTR_SPEC).map(([tag, spec]) => [tag, orderedAttrNames(spec)])
);

export const CALLS = [
  "document",
  "category",
  "include",
  "includeFrame",
  "import",
] as const;

/** One-line docs per attribute (hover / completion). */
export const ATTR_DOCS: Record<string, string> = {
  width: "가로 크기 (`LayoutLength`).",
  height: "세로 크기 (`LayoutLength`).",
  maxWidth: "최대 가로 (`LayoutLength` / CSS max-width).",
  minWidth: "최소 가로 (`LayoutLength` / CSS min-width).",
  align: "표 자체 위치 (`.left` / `.center` / `.right`). 내부 텍스트 정렬 아님.",
  alignment: "셀·텍스트 정렬 (TableColumn `<:>` / Text 등).",
  crossAxisAlignment:
    "Row/Column 교차축 (`align-items`). 기본 `.center`.",
  mainAxisAlignment:
    "Row/Column 주축 (`justify-content`). `.start` / `.center` / `.spaceBetween` 등.",
  spacing: "Row/Column 주축 간격 (`gap`, px 숫자).",
  inline: "`true`면 Row를 `inline-flex`로 (위키 인라인 배치).",
  borderColor: "표 테두리 색 (`HexColor`).",
  bgColor: "배경색 (`HexColor` / light·dark).",
  background: "배경 페인트 (`HexColor` / `RgbaColor` / Gradient).",
  color: "전경(글자) 색.",
  delimiter: "칸 구분 기호 제어. 오타 `delimeter` 아님.",
  colSpan: "가로로 합칠 칸 수.",
  nopad: "`true`면 셀 패딩 제거.",
  text: "표시할 문자열 (보간 `${…}` 가능).",
  size: "글자 크기 (`TextSize` / `.step(n)`).",
  weight: "글자 굵기 (`.bold` / `.regular` 등).",
  decoration: "밑줄·취소선 등 (`.underline` / `.line-through`).",
  fileName: "위키 파일명 (업로드된 이미지).",
  src: "이미지 URL/경로 (fileName 대안).",
  toDocument:
    "내부 문서. `./하위`·`../형제`는 document() 기준. 표시≠대상일 때만 label.",
  toExternal: "외부 URL 링크.",
  label: "Link 표시 문구 (대상과 다를 때만).",
  margin: "바깥 여백 (`Spacing`).",
  padding: "안쪽 여백 (`Spacing`).",
  border: "테두리 일괄 (`Border`).",
  borderTop: "윗변 테두리 (`Border`).",
  borderRight: "오른변 테두리 (`Border`).",
  borderBottom: "아랫변 테두리 (`Border`).",
  borderLeft: "왼변 테두리 (`Border`).",
  borderRadius: "모서리 둥글기 (길이 / CSS).",
  opacity: "불투명도 0…1 (CSS opacity).",
  display: "표시 방식 (`.block` / `.flex` / `.inlineBlock` 등).",
  alignItems: "교차축 정렬 (flex).",
  justifyContent: "주축 정렬 (flex).",
  flexDirection: "flex 방향 (`.row` / `.column`).",
  textAlign: "텍스트 정렬 (`.left` / `.center` / `.right` / `.justify`).",
  wordBreak: "줄바꿈 규칙 (`.keepAll` / `.breakAll`).",
  fontSize: "CSS font-size (`TextSize` 등).",
  fontFamily: "글꼴 패밀리 문자열.",
  styleExtra: "추가 raw CSS (끝에 이어 붙임).",
  title: "접기·문단 제목 문자열.",
  collapsed: "`true`면 `==# … #==` 접힌 문단.",
};

const TAG_SUMMARIES: Record<string, string> = {
  Table: "나무위키 표.",
  TableRow: "표 행. 자식은 `TableColumn`만.",
  TableColumn: "표 칸.",
  Text: "인라인/본문 텍스트.",
  TitleText: "강조 제목 텍스트 (`{{{+1 '''…'''}}}`).",
  Image: "파일 이미지.",
  Link: "문서·외부 링크.",
  Comment: "위키 각주 `[* …]`.",
  Space: "공백 한 칸.",
  br: "`[br]` 줄바꿈.",
  Box: "`{{{#!wiki style}}}` 박스.",
  Row: "가로 flex 스택. `crossAxisAlignment` / `mainAxisAlignment` / `spacing`.",
  Column:
    "세로 flex 스택. `crossAxisAlignment` / `mainAxisAlignment` / `spacing`.",
  Folding: "`{{{#!folding}}}` 접기.",
  Heading:
    "문단 제목. 루트=`==`, 중첩으로 깊이↑. 있으면 `[목차]`+`[clearfix]` 자동. 링크는 `toDocument`/`toExternal`.",
  Quote: "위키 인용구 (`> …`). 자식: Text·Link·Image·br 등.",
  Badge: "칩 스타일 Box sugar.",
  script: "컴포넌트 props 맵.",
  template: "마크업 루트.",
};

/** Built-in tag hover docs (요약 + 필수/택1/선택 구분). */
export const TAG_DOCS: Record<string, string> = Object.fromEntries(
  Object.keys(TAG_SUMMARIES).map((tag) => [tag, formatTagDocs(tag)])
);

export const VALUE_SNIPPETS = [
  "LayoutLength(100)",
  "LayoutLength(100, .percent)",
  'HexColor("#87CEEB")',
  'HexColor("#fff")',
  'HexColor(light="#FFFFFF", dark="#1C1D1F")',
  "RgbaColor(255, 255, 255, 0.5)",
  "Spacing(12)",
  "Spacing(vertical: 5, horizontal: 10)",
  "Spacing(top: 10, horizontal: .auto)",
  "Border(width: 1, style: .solid)",
  "Border(width: 0)",
  'LinearGradient(.toRight, HexColor("#FFB9B9"), HexColor("#FFFDBB"))',
  "ColorStop(HexColor(\"#AFEEEE\"), at: 65)",
  "RadialGradient(.circle, atX: 50, atY: 0, HexColor(\"#000\"), ColorStop(.transparent, at: 30))",
  ".step(1)",
  ".step(-2)",
];

function orderedAttrNames(spec: Record<string, AttrReq>): string[] {
  const required: string[] = [];
  const oneOf: string[] = [];
  const optional: string[] = [];
  for (const [name, req] of Object.entries(spec)) {
    if (req.kind === "required") required.push(name);
    else if (req.kind === "oneOf") oneOf.push(name);
    else optional.push(name);
  }
  return [...required, ...oneOf, ...optional];
}

export function attrReq(tag: string, attr: string): AttrReq | undefined {
  return TAG_ATTR_SPEC[tag]?.[attr];
}

export function attrKindLabel(req: AttrReq): string {
  if (req.kind === "required") return "(필수)";
  if (req.kind === "oneOf") return `(택1:${req.group})`;
  return "(선택)";
}

export function requiredAttrNames(tag: string): string[] {
  const spec = TAG_ATTR_SPEC[tag];
  if (!spec) return [];
  return Object.entries(spec)
    .filter(([, r]) => r.kind === "required")
    .map(([n]) => n);
}

/**
 * First attribute per oneOf group that must appear in tag snippets
 * (required oneOf only — e.g. Link/Image, not optional Heading links).
 */
export function oneOfRepresentatives(tag: string): string[] {
  const spec = TAG_ATTR_SPEC[tag];
  if (!spec) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [name, req] of Object.entries(spec)) {
    if (req.kind !== "oneOf") continue;
    if (req.required === false) continue;
    if (seen.has(req.group)) continue;
    seen.add(req.group);
    out.push(name);
  }
  return out;
}

export type OneOfGroupInfo = { names: string[]; required: boolean };

export function oneOfGroups(tag: string): Map<string, OneOfGroupInfo> {
  const spec = TAG_ATTR_SPEC[tag];
  const map = new Map<string, OneOfGroupInfo>();
  if (!spec) return map;
  for (const [name, req] of Object.entries(spec)) {
    if (req.kind !== "oneOf") continue;
    const cur = map.get(req.group) ?? {
      names: [],
      required: req.required !== false,
    };
    cur.names.push(name);
    if (req.required === false) cur.required = false;
    map.set(req.group, cur);
  }
  return map;
}

/**
 * Snippet body after `<` for tag completion.
 * Includes required attrs + one representative per oneOf group.
 */
export function tagCompletionSnippet(tag: string): string {
  const req = requiredAttrNames(tag);
  const reps = oneOfRepresentatives(tag);
  const attrs = [...req, ...reps];
  let tab = 1;
  const parts = attrs.map((a) => `${a}="\${${tab++}}"`);
  const voidish = ["br", "Space", "Image", "Link", "TitleText", "Badge"].includes(
    tag
  );
  const selfClosingPreferred = [
    "Heading",
    "Text",
    "Image",
    "Link",
    "TitleText",
    "Comment",
    "br",
    "Space",
    "Badge",
  ].includes(tag);

  if (tag === "Folding") {
    return `Folding title="\${1:제목}">\n\t$0\n</Folding>`;
  }
  if (tag === "Quote") {
    return `Quote>\n\t$0\n</Quote>`;
  }
  if (parts.length === 0) {
    if (selfClosingPreferred || voidish) return `${tag} />`;
    return `${tag}>$0</${tag}>`;
  }
  if (selfClosingPreferred || voidish) {
    return `${tag} ${parts.join(" ")} />`;
  }
  return `${tag} ${parts.join(" ")}>\n\t$0\n</${tag}>`;
}

export function formatTagDocs(tag: string): string {
  const summary = TAG_SUMMARIES[tag] ?? tag;
  const spec = TAG_ATTR_SPEC[tag];
  if (!spec || Object.keys(spec).length === 0) return summary;

  const required: string[] = [];
  const oneOfLines: string[] = [];
  const optional: string[] = [];
  const groups = oneOfGroups(tag);

  for (const [name, req] of Object.entries(spec)) {
    const doc = ATTR_DOCS[name] ?? "";
    const line = `- \`${name}\`: ${doc}`;
    if (req.kind === "required") required.push(line);
    else if (req.kind === "optional") optional.push(line);
  }
  for (const [group, info] of groups) {
    const need = info.required ? "정확히 하나" : "최대 하나";
    oneOfLines.push(
      `- **택1 \`${group}\`** (${need}): ${info.names.map((n) => `\`${n}\``).join(" | ")}`
    );
    for (const n of info.names) {
      oneOfLines.push(`  - \`${n}\`: ${ATTR_DOCS[n] ?? ""}`);
    }
  }

  const sections: string[] = [summary];
  if (required.length) sections.push("### 필수\n" + required.join("\n"));
  if (oneOfLines.length) sections.push("### 택1\n" + oneOfLines.join("\n"));
  if (optional.length) sections.push("### 선택\n" + optional.join("\n"));
  return sections.join("\n\n");
}

const KNOWN = new Set<string>(TAGS);

export function isKnownTag(name: string): boolean {
  return KNOWN.has(name);
}

export function closestTag(name: string): string | undefined {
  const lower = name.toLowerCase();
  let best: string | undefined;
  let bestDist = Infinity;
  for (const t of TAGS) {
    const d = levenshtein(lower, t.toLowerCase());
    if (d < bestDist && d <= 3) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}
