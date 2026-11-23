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
  "Badge",
  "script",
  "template",
] as const;

export type TagName = (typeof TAGS)[number];

export const TAG_ATTRS: Record<string, string[]> = {
  Table: ["width", "align", "borderColor", "bgColor"],
  TableRow: ["alignment"],
  TableColumn: [
    "width",
    "bgColor",
    "alignment",
    "delimiter",
    "colSpan",
    "nopad",
  ],
  Text: ["text", "size", "color", "weight", "decoration", "alignment"],
  TitleText: ["text"],
  Image: ["fileName", "src", "width", "height"],
  Link: ["toDocument", "toExternal", "label"],
  Comment: ["text"],
  Space: [],
  br: [],
  Box: [
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
  ],
  Row: [
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
  ],
  Column: [
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
  ],
  Folding: ["title"],
  Heading: ["level", "title", "collapsed"],
  Badge: ["bgColor", "borderRadius", "padding", "color"],
};

export const CALLS = ["category", "include", "includeFrame", "import"] as const;

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
  toDocument: "내부 문서 링크 대상.",
  toExternal: "외부 URL 링크.",
  label: "링크에 보이는 텍스트.",
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
  level: "문단 깊이 1…6 (`=` 개수).",
  collapsed: "`true`면 `==# … #==` 접힌 문단.",
};

/** Built-in tag hover docs (요약 + 속성 한 줄 목록). */
export const TAG_DOCS: Record<string, string> = Object.fromEntries(
  (
    [
      ["Table", "나무위키 표."],
      ["TableRow", "표 행. 자식은 `TableColumn`만."],
      ["TableColumn", "표 칸."],
      ["Text", "인라인/본문 텍스트."],
      ["TitleText", "강조 제목 텍스트 (`{{{+1 '''…'''}}}`)."],
      ["Image", "파일 이미지."],
      ["Link", "문서·외부 링크."],
      ["Comment", "위키 각주 `[* …]`."],
      ["Space", "공백 한 칸."],
      ["br", "`[br]` 줄바꿈."],
      ["Box", "`{{{#!wiki style}}}` 박스."],
      [
        "Row",
        "가로 flex 스택. `crossAxisAlignment` / `mainAxisAlignment` / `spacing`.",
      ],
      [
        "Column",
        "세로 flex 스택. `crossAxisAlignment` / `mainAxisAlignment` / `spacing`.",
      ],
      ["Folding", "`{{{#!folding}}}` 접기."],
      ["Heading", "`== … ==` 문단 제목."],
      ["Badge", "칩 스타일 Box sugar."],
      ["script", "컴포넌트 props 맵."],
      ["template", "마크업 루트."],
    ] as const
  ).map(([tag, summary]) => {
    const attrs = TAG_ATTRS[tag] ?? [];
    const lines = attrs.map((a) => `- \`${a}\`: ${ATTR_DOCS[a] ?? ""}`);
    const body = lines.length ? `${summary}\n\n${lines.join("\n")}` : summary;
    return [tag, body];
  })
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
