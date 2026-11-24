---
name: nwiki-grammar
description: >-
  Quick reference for .nwiki grammar and namuwiki raw mappings in this repo.
  Use when editing .nwiki files, answering nwiki/syntax/위키 문법 questions,
  mapping tags to raw markup, or proposing category/includeFrame/import/Heading/Box constructs.
---

# nwiki 문법 빠른 참조

`.nwiki`는 HTML/JSX가 아니다. **엔진·확장이 지원하는 것만** 쓰고 제안한다.

## 정본 (충돌 시 여기 우선)

| 대상 | 경로 |
|------|------|
| 문법·타입 | `wiki-kit/docs/SPEC.nwiki` |
| 태그/속성 **필수·택1·선택** | `wiki-kit/vscode-nwiki/src/catalog.ts` → `TAG_ATTR_SPEC` |
| 타입·CommonFrame | `wiki-kit/vscode-nwiki/src/members.ts` |
| 예제 | `wiki-kit/examples/*.nwiki`, `김마리/` |

도구(자동완성·호버·진단)와 에이전트는 **`TAG_ATTR_SPEC`**을 따른다. SPEC의 `String`/`String?`는 사람용 서술.

태그 자동완성 시 **필수 속성(+ 필수 택1 대표)**을 스니펫으로 넣는다. 선택 속성은 넣지 않는다.

| 태그 | 완성 예 |
|------|---------|
| `Heading` | `<Heading title="$1" />` |
| `Text` | `<Text text="$1" />` |
| `Link` | `<Link toDocument="$1" />` (택1: toDocument\|toExternal) |
| `Image` | `<Image fileName="$1" />` (택1: fileName\|src) |
| `Folding` | `<Folding title="$1">…</Folding>` |

상세 시그니처가 필요하면 SPEC/catalog를 읽고, 추측으로 새 태그를 만들지 않는다.

## 문서 뼈대

```nwiki
document("표제어")            /* toDocument ./ · ../ 기준; 출력 없음 */
category("분류명")
includeFrame(.adult)          /* 또는 includeFrame("틀제목") / include("…") */
import(ProfileTable)          /* 컴포넌트 Ident */
import("../data/designSystem.json")  /* stem → ${designSystem.key} ; top-level 또는 <script> */

<script>
  let props: [String: String] = { "name": "…" }
</script>

<template>
  …
</template>
```

- top-level 호출: `category` / `include` / `includeFrame` / `import` (한 줄에 하나)
- JSON import: 경로가 `.json`이면 데이터; stem 네임스페이스; flat string 맵만
- 컴포넌트 import: bare Ident 또는 비-json 문자열; `<Name …/>`로 인라인

## 위키 개념 ↔ nwiki

| 위키 | nwiki | raw 예 |
|------|-------|--------|
| 문단/섹션 | `<Heading title collapsed? toDocument?>` | 루트 `==`, 중첩 `===`… |
| 목차 | 루트 Heading 있으면 **자동** | `[목차]` + `[clearfix]` (첫 Heading 직전) |
| 분류 | `category("…")` | `[[분류:…]]` |
| 틀 | `includeFrame(…)` / `include("…")` | `[include(틀:…)]` |
| 접기 | `<Folding title>` | `{{{#!folding [ title ]` |
| 인용 | `<Quote>` | 줄 앞 `> ` |
| wiki style 박스 | `<Box …>` | `{{{#!wiki style="…"` |

- Heading **등급 = 중첩 깊이** (`level=` 금지). 루트=`==`(2). `collapsed=true` → `=# #=`.
- 링크 문단: `title` + `toDocument`/`toExternal`. Link는 `label`을 **표시≠대상일 때만**.
- `toDocument="./하위"` → `document명/하위`; `"../형제"` → 부모/`형제`. 리터럴 `./`는 소스 `"\\./…"`.
- `<Toc />` 없음.

## 허용 태그 (catalog)

`Table` `TableRow` `TableColumn` `Text` `TitleText` `Image` `Link` `Comment` `Space` `br` `Box` `Row` `Column` `Folding` `Heading` `Quote` `Badge` + `import`된 컴포넌트

### 자주 쓰는 매핑

| nwiki | raw 요지 |
|-------|----------|
| `Table` / `TableRow` / `TableColumn` | `\|\|` 표. Row 직속은 Column만 |
| `Text` / `TitleText` | 본문 / 제목형 텍스트 |
| `Link toDocument` / `toExternal` | `[[문서]]` / `[[url\|label]]` |
| `Image fileName` / `src` | `[[파일:…]]` 등 |
| `Comment` | `##` 접미 주석 (직전 형제에 붙음) |
| `Badge` | 인라인 뱃지 스타일 wiki |
| `Row` / `Column` | flex 스택 (`#!wiki style`) |

## 값·타입 치트

- `HexColor("#RGB"\|"#RRGGBB")` — **8/4자리 알파 hex 금지**; 투명은 `RgbaColor` / opacity / gradient
- `HexColor(light="…", dark="…")` → `light,dark`
- `LayoutLength(100)` / `LayoutLength(50, .percent)` → `100` / `50%`
- enum: `.right`, `.bold`, `.percent` 등 (연관값은 `[]`로 감싸지 않음)
- 보간: `"${props.name}"`, `"${designSystem.accentColor}"`

## CommonFrame (자주 씀)

`includeFrame(.adult)` → 틀:선정성 (구어 19금 아님)  
`.spoiler` / `.discussion("사유")` / `.parentDocument("…")` / `.relatedDocuments(…)` / 문자열 틀 제목

정본 associated-call: `includeFrame(.discussion("표제어"))`  
동등: `includeFrame(.discussion, "표제어")`

## 금지 (제안하지 말 것)

- HTML/JSX (`div`, `className`, …), Emmet, 미지원 매크로를 nwiki 태그인 척 추가
- SPEC 의사코드만 있고 엔진에 없는 API
- `틀:19금` (정본 `.adult`)
- `Heading level=…` (중첩 사용)
- JSON 중첩·배열·숫자 (1차는 flat string만)
- `delimeter` 오타 → `delimiter`

## 응답 요령

문법 질문에는 **해당 태그/호출 + raw 한 줄**로 바로 답하고, 애매하면 SPEC/catalog를 연다. 구현 요청이면 카탈로그·렌더러·테스트까지 맞춘다.
