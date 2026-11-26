/** Static member catalog for `.` completion (heuristic, not a full typechecker). */

export type MemberKind = "enum" | "init" | "method" | "prop";

export interface TypeMember {
  name: string;
  kind: MemberKind;
  /** Insert text / snippet (without leading type name for Type. members) */
  insert: string;
  detail?: string;
  /** Markdown shown on hover / completion */
  documentation?: string;
  /** If true, insert includes leading `.` (enum cases in value position) */
  dotted?: boolean;
}

export interface TypeInfo {
  name: string;
  members: TypeMember[];
  /** Type-level markdown docs */
  documentation?: string;
}

/** Built-in type hover docs (SPEC summaries). */
export const TYPE_DOCS: Record<string, string> = {
  HexColor:
    "raw hex 문자열을 검증한 뒤 wikiValue로 직렬화한다.\n\n" +
    "입력: `#RGB`(3) 또는 `#RRGGBB`(6). `#` 없으면 붙여서 파싱. 대소문자 무시.\n\n" +
    "bare `#222` 리터럴·`.hex(#RGB)` sugar·프리셋(`HexColor.white` / `.black` / `.transparent`) 지원.\n\n" +
    "나무위키는 `#RRGGBBAA` / `#RGBA` 투명 헥스를 지원하지 않는다 → `RgbaColor` / `opacity` / `.transparent` 사용.",
  DesignSystem:
    '`import DesignSystem from "./data/design-system.json"` 으로 바인딩. ' +
    "키는 JSON flat string만. template에서 `DesignSystem.key` / `${DesignSystem.key}`. " +
    "임의 타입·extension·let 선언 없음 (예약 HexColor 등만 호출).",
  LayoutLength:
    "레이아웃 길이. `LayoutLength(n)` 또는 `LayoutLength(n .percent)`.\n\npercent일 때 0…100, point일 때 length > 0.",
  TextSize:
    "텍스트 크기. `TextSize.step(n)` → 위키 `{{{+n}}}` 상대 크기.",
  Spacing: "CSS margin/padding용 간격. 단일·축·사방 init 지원.",
  Border: "`Border(width=1 style=.solid)` — width 0이면 `border: none`.",
  RgbaColor: "CSS `rgba()` — wiki style / 그라데이션 투명도.",
  LinearGradient: "선형 그라데이션. 방향 enum + 색 스톱.",
  ColorStop: "그라데이션 스톱. `ColorStop(color at=percent)`.",
  CommonFrame:
    "자주 쓰는 공통 틀 enum. `includeFrame(.case)` / associated-call 지원.\n\n`adult` = 틀:선정성 (구어 19금).",
};

/** CommonFrame cases for includeFrame( / include( */
export const COMMON_FRAME_MEMBERS: TypeMember[] = [
  {
    name: "spoiler",
    kind: "enum",
    insert: ".spoiler",
    dotted: true,
    detail: "틀:스포일러",
    documentation: "`[include(틀:스포일러)]`",
  },
  {
    name: "spoilerSection",
    kind: "enum",
    insert: ".spoilerSection",
    dotted: true,
    detail: "틀:스포일러/문단",
    documentation: "`[include(틀:스포일러/문단)]`",
  },
  {
    name: "spoilerPreview",
    kind: "enum",
    insert: '.spoilerPreview("${1:작품명}", "${2:화수}")',
    dotted: true,
    detail: "틀:스포일러/선 연재분",
    documentation: "`includeFrame(.spoilerPreview(작품명, 화수))`",
  },
  {
    name: "adult",
    kind: "enum",
    insert: ".adult",
    dotted: true,
    detail: "틀:선정성 (19금)",
    documentation:
      "**선정성** 틀 (`adult`). 구어 ‘19금’. `틀:19금`이 아님.\n\n`[include(틀:선정성)]`",
  },
  {
    name: "incident",
    kind: "enum",
    insert: ".incident",
    dotted: true,
    detail: "틀:사건사고",
    documentation: "`[include(틀:사건사고)]`",
  },
  {
    name: "unpublished",
    kind: "enum",
    insert: ".unpublished",
    dotted: true,
    detail: "틀:미공개",
    documentation: "`[include(틀:미공개)]`",
  },
  {
    name: "stub",
    kind: "enum",
    insert: ".stub",
    dotted: true,
    detail: "틀:토막글",
    documentation: "`[include(틀:토막글)]`",
  },
  {
    name: "parentDocument",
    kind: "enum",
    insert: '.parentDocument("${1:문서}")',
    dotted: true,
    detail: "틀:상위 문서",
    documentation: "`includeFrame(.parentDocument(\"문서\"))` → `문서명1=`",
  },
  {
    name: "childDocuments",
    kind: "enum",
    insert: '.childDocuments("${1}", "${2}")',
    dotted: true,
    detail: "틀:하위 문서",
    documentation: "`includeFrame(.childDocuments(…))` → `문서명1…`",
  },
  {
    name: "relatedDocuments",
    kind: "enum",
    insert: '.relatedDocuments("${1}", "${2}")',
    dotted: true,
    detail: "틀:관련 문서",
    documentation: "`includeFrame(.relatedDocuments(…))` → `문서명1…`",
  },
  {
    name: "detail",
    kind: "enum",
    insert: '.detail("${1:문서명}")',
    dotted: true,
    detail: "틀:상세 내용",
    documentation: "`includeFrame(.detail(\"문서\"))` → `문서명=`",
  },
  {
    name: "disambiguation",
    kind: "enum",
    insert: '.disambiguation("${1}")',
    dotted: true,
    detail: "틀:다른 뜻",
    documentation: "`includeFrame(.disambiguation(…))`",
  },
  {
    name: "discussion",
    kind: "enum",
    insert: '.discussion("${1:사유}")',
    dotted: true,
    detail: "틀:토론 중",
    documentation:
      "정본: `includeFrame(.discussion(\"사유\"))`\n\n동등: `includeFrame(.discussion, \"사유\")`",
  },
  {
    name: "consensus",
    kind: "enum",
    insert: '.consensus("${1}")',
    dotted: true,
    detail: "틀:토론 합의",
    documentation: "`includeFrame(.consensus(…))`",
  },
  {
    name: "npov",
    kind: "enum",
    insert: ".npov",
    dotted: true,
    detail: "틀:NPOV",
    documentation: "`[include(틀:NPOV)]`",
  },
  {
    name: "mpov",
    kind: "enum",
    insert: ".mpov",
    dotted: true,
    detail: "틀:MPOV",
    documentation: "`[include(틀:MPOV)]`",
  },
  {
    name: "accessRestricted",
    kind: "enum",
    insert: ".accessRestricted",
    dotted: true,
    detail: "틀:접근 제한",
    documentation: "`[include(틀:접근 제한)]`",
  },
];

export const TYPE_MEMBERS: Record<string, TypeInfo> = {
  HexColor: {
    name: "HexColor",
    documentation: TYPE_DOCS.HexColor,
    members: [
      {
        name: "init",
        kind: "init",
        insert: 'HexColor("${1:#fff}")',
        detail: "init(_ color)",
      },
      {
        name: "initLightDark",
        kind: "init",
        insert: "HexColor(light=${1:#FFFFFF} dark=${2:#1C1D1F})",
        detail: "init(light= dark=) — bare #hex OK",
      },
      {
        name: "hex",
        kind: "method",
        insert: ".hex(${1:#fff})",
        dotted: true,
        detail: ".hex(#RGB|#RRGGBB)",
        documentation: "단일 색 sugar. `color=.hex(#abc)`",
      },
      {
        name: "white",
        kind: "prop",
        insert: "white",
        detail: "HexColor.white → #fff",
      },
      {
        name: "black",
        kind: "prop",
        insert: "black",
        detail: "HexColor.black → #000",
      },
      {
        name: "transparent",
        kind: "prop",
        insert: "transparent",
        detail: "HexColor.transparent",
      },
      {
        name: "wikiValue",
        kind: "prop",
        insert: "wikiValue",
        detail: "SPEC / 문서용",
      },
      {
        name: "lightModeValue",
        kind: "prop",
        insert: "lightModeValue",
        detail: "SPEC / 문서용",
      },
      {
        name: "darkModeValue",
        kind: "prop",
        insert: "darkModeValue",
        detail: "SPEC / 문서용",
      },
    ],
  },
  DesignSystem: {
    name: "DesignSystem",
    documentation: TYPE_DOCS.DesignSystem,
    members: [
      {
        name: "defaultColor",
        kind: "prop",
        insert: "defaultColor",
        detail: "전경 프리셋 (기본 #222,#ddd)",
      },
      {
        name: "defaultBgColor",
        kind: "prop",
        insert: "defaultBgColor",
        detail: "배경 프리셋 (기본 #ddd,#222)",
      },
    ],
  },
  LayoutLength: {
    name: "LayoutLength",
    members: [
      {
        name: "init",
        kind: "init",
        insert: "LayoutLength(${1:100})",
        detail: "init(_ length)",
      },
      {
        name: "initPercent",
        kind: "init",
        insert: "LayoutLength(${1:100} .percent)",
        detail: "init(_: .percent)",
      },
      {
        name: "wikiValue",
        kind: "prop",
        insert: "wikiValue",
        detail: "SPEC / 문서용",
      },
    ],
  },
  TextSize: {
    name: "TextSize",
    members: [
      {
        name: "step",
        kind: "method",
        insert: "step(${1:1})",
        detail: "step(_ value)",
      },
      {
        name: "init",
        kind: "init",
        insert: "TextSize(${1:16})",
        detail: "init(_ point)",
      },
    ],
  },
  Spacing: {
    name: "Spacing",
    members: [
      {
        name: "init",
        kind: "init",
        insert: "Spacing(${1:12})",
        detail: "init(_ all)",
      },
      {
        name: "initAxes",
        kind: "init",
        insert: "Spacing(vertical=${1:5} horizontal=${2:10})",
        detail: "vertical/horizontal",
      },
      {
        name: "initSides",
        kind: "init",
        insert:
          "Spacing(top=${1:0} right=${2:0} bottom=${3:0} left=${4:0})",
        detail: "top/right/bottom/left",
      },
    ],
  },
  Border: {
    name: "Border",
    members: [
      {
        name: "init",
        kind: "init",
        insert: "Border(width=${1:1} style=.solid)",
        detail: "init(width:style:)",
      },
      {
        name: "none",
        kind: "init",
        insert: "Border(width=0)",
        detail: "→ border: none",
      },
    ],
  },
  RgbaColor: {
    name: "RgbaColor",
    members: [
      {
        name: "init",
        kind: "init",
        insert: "RgbaColor(${1:255} ${2:255} ${3:255} ${4:0.5})",
        detail: "init(r,g,b,a)",
      },
    ],
  },
  LinearGradient: {
    name: "LinearGradient",
    members: [
      {
        name: "init",
        kind: "init",
        insert:
          'LinearGradient(.toRight HexColor("${1:#FFB9B9}") HexColor("${2:#FFFDBB}"))',
        detail: "direction + stops",
      },
    ],
  },
  ColorStop: {
    name: "ColorStop",
    members: [
      {
        name: "init",
        kind: "init",
        insert: 'ColorStop(HexColor("${1:#AFEEEE}") at=${2:65})',
        detail: "color + at%",
      },
    ],
  },
  CommonFrame: {
    name: "CommonFrame",
    members: COMMON_FRAME_MEMBERS.map((m) => ({
      ...m,
      insert: m.insert.replace(/^\./, ""),
      dotted: false,
    })),
  },
};

/** Attribute → expected value type (for `attr=.` static/enum member completion). */
export const ATTR_TYPES: Record<string, string> = {
  size: "TextSize",
  fontSize: "TextSize",
};

/** Enum cases suggested after `attr=` by attribute name */
export const ATTR_ENUMS: Record<string, string[]> = {
  display: [".block", ".inline", ".inlineBlock", ".inlineFlex", ".flex"],
  align: [".left", ".center", ".right"],
  alignment: [".left", ".center", ".right"],
  textAlign: [".left", ".center", ".right", ".justify", ".start", ".end"],
  wordBreak: [".keepAll", ".breakAll", ".normal"],
  weight: [".bold", ".regular", ".medium", ".semiBold"],
  decoration: [".italic", ".underline", ".line-through"],
  flexDirection: [".row", ".column"],
  alignItems: [".center", ".flexStart", ".flexEnd", ".stretch", ".baseline"],
  justifyContent: [
    ".center",
    ".flexStart",
    ".flexEnd",
    ".spaceBetween",
    ".spaceAround",
    ".spaceEvenly",
  ],
  collapsed: ["true", "false"],
};

export const KNOWN_TYPE_NAMES = Object.keys(TYPE_MEMBERS);
