# wiki-kit

`.nwiki`로 문서를 조립하고, 검증·빌드 후 나무위키 raw(`outputs/*.md`)를 붙여넣는다.

## 왜 하는가

나무위키 raw는 표·각주·중첩 `{{{` 한곳이 깨져도 전체가 망가지기 쉽다.  
자주 쓰는 덩어리를 **컴포넌트/태그**로 두고 문서에서는 조합만 한다.

## nwiki 한눈에

| 단계 | 내용 |
|------|------|
| 작성 | `examples/*.nwiki` — `category` / `includeFrame` / `import` + `<template>` |
| 스펙 | [`docs/SPEC.nwiki`](docs/SPEC.nwiki) (엔진 입력 아님, 문법 정본) |
| 엔진 | `engine/nwiki/` — 파서 · 렌더 · `CommonFrame` · `import` 해석 |
| 검증 | 태그/속성 규칙, HexColor 3/6자리, Heading 중첩 깊이 등 |
| 빌드 | `outputs/<stem>.md` |
| 에디터 | [`vscode-nwiki/`](vscode-nwiki/README.md) |

레거시 `[@Component]` / `*.ncomp` / `pages/*.json` 도 같은 CLI에 남아 있으며, nwiki와 **병행**한다.

## 구조

```
wiki-kit/
├── docs/SPEC.nwiki
├── examples/
│   ├── introduce.nwiki       # import(ProfileTable) 소개 문서
│   ├── ProfileTable.nwiki
│   ├── box_header.nwiki      # Box / Folding / Badge
│   ├── common_frames.nwiki   # CommonFrame
│   └── subpage_nav.nwiki
├── fixtures/*.golden.md
├── engine/nwiki/             # ast · parser · render · frames · resolve …
├── vscode-nwiki/
├── tests/test_nwiki_introduce.py
├── scripts/build.py
├── components/ · templates/ · pages/   # 레거시
└── outputs/                  # gitignore
```

## 빌드 · 테스트

```bash
cd wiki-kit

python3 scripts/build.py build examples/introduce.nwiki
python3 scripts/build.py build examples/introduce.nwiki --check-golden
python3 scripts/build.py build examples/box_header.nwiki --check-golden
python3 -m unittest tests/test_nwiki_introduce.py
```

지원 문법 요약:

- `includeFrame(.adult)` / `.discussion("사유")` / 문자열 틀 제목
- `Box` 스타일 · `LinearGradient` · `Heading`(중첩=`=` 깊이, 목차 자동) · `Folding`
- `import(ProfileTable)` → 컴포넌트 `.nwiki` 인라인
- `import("./data/designSystem.json")` → stem 네임스페이스로 `${designSystem.key}` 주입

## VS Code / Cursor 확장

```bash
cd vscode-nwiki && npm install && npm run install:local
```

설치 후 **Developer: Reload Window**.  
자동완성 · `///` 호버 · 근사 프리뷰 · `/`·`>` 태그 닫기 · 저장 시 빌드.

## 레거시 CLI

```bash
python3 scripts/build.py list
python3 scripts/build.py validate
python3 scripts/build.py build
python3 scripts/build.py build demo-intro
```

## 아직 초안인 것

- 완전한 타입 추론 / LSP 서버 분리 없음 (확장 휴리스틱 카탈로그)
- 레거시 `김마리/` 토큰 빌드와 nwiki 자동 연동 없음
- props 배열 map 등 고급 스크립트 미구현
