---
name: nwiki-grammar
description: >-
  Quick reference for .nwiki grammar, namuwiki raw mappings, project scaffold,
  and starter templates in this repo. Use when editing .nwiki, answering
  nwiki/syntax/위키 문법 questions, scaffolding New Document, inserting
  Frame/ProfileTable/Article starters, or mapping tags to raw markup.
---

# nwiki 문법 빠른 참조

`.nwiki`는 HTML/JSX가 아니다. **엔진·확장이 지원하는 것만** 쓰고 제안한다.

## 정본 (충돌 시 여기 우선)

| 대상 | 경로 |
|------|------|
| 문법·타입 | `wiki-kit/docs/SPEC.nwiki` (확장: `nwiki: Open Spec Guide`) |
| 태그/속성 **필수·택1·선택** | `wiki-kit/vscode-nwiki/src/catalog.ts` → `TAG_ATTR_SPEC` |
| 타입·CommonFrame | `wiki-kit/vscode-nwiki/src/members.ts` |
| 스타터 본문 | `wiki-kit/vscode-nwiki/src/starterTemplates.ts` |
| 예제 | `wiki-kit/examples/*.nwiki` (저장소 샘플 프로젝트) |

도구·에이전트는 **`TAG_ATTR_SPEC`**을 따른다. SPEC의 `String`/`String?`는 사람용 서술.

| 태그 | 완성 예 |
|------|---------|
| `Heading` | `<Heading title="$1" />` |
| `Text` | `<Text text="$1" />` |
| `Link` | `<Link toDocument="$1" />` (택1: toDocument\|toExternal) |
| `Image` | `<Image fileName="$1" />` (택1: fileName\|src) |
| `Folding` | `<Folding title="$1">…</Folding>` |

## 프로젝트·빈 도화지

| 수단 | 용도 |
|------|------|
| `nwiki: New Document` | `{문서명}/` + `index.nwiki` + `data/design-system.json` + `components/` `outputs/` `scripts/` + `nwiki.json` |
| `nwiki: Insert Frame Template` | 둘러보기 틀 골격 (`nwframe` 스니펫) |
| `nwiki: Insert ProfileTable Template` | 프로필 표 컴포넌트 (`nwprofile`) |
| `nwiki: Insert Article Template` | 목차·본문 페이지 (`nwpage`) |
| `nwiki: Open Spec Guide` | SPEC 열기 (확장 `runtime/docs` 또는 wiki-kit) |
| 빌드 | 확장 내장 `runtime/` 엔진 — 문서 폴더만 열어도 OK → `{프로젝트}/outputs/` |

문서명 추론(명령): `nwiki.json` → `document()`/`frame()` → 폴더명 → 입력 폴백. **다시 묻지 말고** 문서명을 쓴다. Emmet은 nwiki에서 제외 — 스타터는 스니펫·명령만.

JSON 파일명: **`design-system.json`** (kebab). 참조는 `DesignSystem.*`.

## 문서 뼈대

```nwiki
document("문서명")
frame("문서명")         /* = document("틀:문서명") */
import DesignSystem from "./data/design-system.json"
import ProfileTable from "./components/ProfileTable.nwiki"
category("분류명")
includeFrame(.adult)

<template>
  <ProfileTable name="문서명" />
  <!-- DesignSystem.key / HexColor(light:dark:) 예약 호출만 -->
</template>
```

컴포넌트:

```nwiki
props {
  name: String          /* 필수; String? = 선택. 기본값 없음 */
}
<template>
  <TitleText text="${props.name}" />
</template>
```

- `<script>` 금지. `<template>` 필수. `extension` / 실행 `let` / 임의 타입 선언 없음.
- top-level: `document` / `frame` / `import` / `category` / `include` / `includeFrame` / `props`
- `import Name from "path"` — `.json`→네임스페이스(flat string 키), `.nwiki`→태그명
- 공유 토큰은 JSON에 추가 후 `DesignSystem.key`. 듀얼 테마는 `"#222,#ddd"` 문자열.
- 페인트: 예약 `HexColor` / `.hex(#RGB)` / `HexColor.white` / `DesignSystem.*` / bare `#222`

## 위키 개념 ↔ nwiki

| 위키 | nwiki | raw 예 |
|------|-------|--------|
| 문단/섹션 | `<Heading title collapsed? toDocument?>` | 루트 `==`, 중첩 `===`… |
| 목차 | 루트 Heading 있으면 **자동** | `[목차]` + `[clearfix]` |
| 분류 | `category("…")` | `[[분류:…]]` |
| 틀 | `includeFrame(…)` / `include("…")` | `[include(틀:…)]` |
| 접기 | `<Folding title>` | `{{{#!folding [ title ]` |
| 인용 | `<Quote>` | 줄 앞 `> ` |
| wiki style 박스 | `<Box …>` | `{{{#!wiki style="…"` |

- Heading **등급 = 중첩 깊이** (`level=` 금지). 루트=`==`(2). `collapsed=true` → `=# #=`.
- `toDocument="./하위"` → `document명/하위`. 리터럴 `./`는 `"\\./…"`.
- `<Toc />` 없음.

## 허용 태그 (catalog)

`Table` `TableRow` `TableColumn` `Text` `TitleText` `Image` `Link` `Comment` `Space` `br` `Box` `Folding` `Heading` `Quote` `Badge` + import된 컴포넌트

| nwiki | raw 요지 |
|-------|----------|
| `Table` / Row / Column | `\|\|` 표. Row 직속은 Column만 |
| `Text` / `TitleText` | 본문 / `{{{+1 '''…'''}}}`. `weight`/`decoration`/`color` |
| `Link` / `Image` | `[[문서]]` / `[[파일:…]]` |
| `Box` | `#!wiki style` 레이아웃. 기본 flex+column·`gap`. 글자색은 자식에 |
| `Comment` | `##` 접미 |

## 값·타입 치트

- `HexColor` — `#RGB`/`#RRGGBB`만; 알파 hex 금지 → `RgbaColor` / opacity
- `HexColor(light: #…, dark: #…)` → `light,dark` (bare `#` 허용)
- `LayoutLength(100)` / `(50, .percent)`
- enum: `.right`, `.bold`, `.percent` …
- 보간: `"${props.name}"`, `"${DesignSystem.accentColor}"`

## CommonFrame

`includeFrame(.adult)` → 틀:선정성  
`.spoiler` / `.discussion("사유")` / `.parentDocument("…")` / `.relatedDocuments(…)`

## 금지

- HTML/JSX·Emmet·미지원 API를 nwiki인 척 추가
- `<script>` / `let props` 맵 / `Heading level=`
- `틀:19금` (정본 `.adult`)
- JSON 중첩·배열·숫자 (flat string만)
- `delimeter` → `delimiter`
- `designSystem.json` 구 파일명 제안 (정본 `design-system.json`)

## 응답 요령

문법 → **태그/호출 + raw 한 줄**. 빈 파일 → New Document / Insert * Template / Open Spec을 안내. 애매하면 SPEC·catalog를 연다.
