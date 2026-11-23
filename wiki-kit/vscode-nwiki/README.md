# nwiki (VS Code / Cursor)

`.nwiki` 언어 지원 확장 — 자동완성, 스니펫, 문법 진단, Quick Fix, 정렬, 저장 시 빌드.

## 로컬 설치

Extension Development Host(F5) 없이 Cursor/VS Code에 직접 심볼릭 링크로 설치한다.

```bash
cd wiki-kit/vscode-nwiki
npm install
npm run install:local
```

이후 **Developer: Reload Window** (`Cmd+Shift+P`).  
Output 채널 `nwiki`에 `nwiki extension activated`가 보이면 로드된 것.

| 명령 | 설명 |
|------|------|
| `npm run install:local` | 컴파일 후 `~/.cursor/extensions/<publisher>.nwiki-<ver>`에 링크 |
| `npm run uninstall:local` | 로컬 링크 제거 |
| `npm run watch` | 소스 변경 시 재컴파일 — 반영은 Reload Window |

코드 수정 후: `npm run compile`(또는 watch) → Reload Window.

## 기능

| 기능 | 설명 |
|------|------|
| 자동완성 | 태그·속성·`Box`/`Folding`/`Heading`/`Badge`·`category`/`include`/`includeFrame`/`import` · `import("….json")` 키 (`${ns.`) |
| `.` 멤버 완성 | `includeFrame(.` → CommonFrame, `Type.` → init/정적, 값.` → 인스턴스, `attr=` → 기대 enum |
| `///` 문서 · 호버 | `///` 마크다운 문서 주석 → 식별자 호버/자동완성 툴팁. Enter 시 같은 열에 `/// ` 연속 |
| 스니펫 | `tbl`, `tr`, `tc`, `tx`, `lk`, `img`, `cmt`, `cat`, `impj` … |
| Emmet | `nwiki`에서 제외 (HTML 오제안 방지). Cursor Tab도 `nwiki` 비활성 → 확장 카탈로그 완성만 사용 |
| 진단 | 빨간 밑줄 + hover (파서·오타·알 수 없는 태그·JSON import 실패) |
| Quick Fix | `Ctrl+.` / `Cmd+.` |
| 정렬 | 저장 시(기본), `Ctrl+Alt+L` / `Cmd+Option+L`, 선택적 개행 시 |
| 빌드 | 저장 시 `python3 scripts/build.py build <file>` → `outputs/<stem>.md` 열기 |
| 프리뷰 | 빌드 후 나무위키 raw 근사 HTML Webview (표·문단·wiki style·접기 등) |
| 태그 닫기 | `/` → `/>` (속성 있는 태그는 `<Tag \| />` 슬롯, ↑↓면 여백 취소) · `>` → `></Tag>`, Enter 시 줄바꿈 확장 |
| 태그 여러 줄 | 커서 `<Tag …>` 안 + `Ctrl+M` — 속성 여러 줄 ↔ 한 줄 토글 (Xcode Format to Multiple Lines) |
| 주석 | 토글 블록 주석 = `<!-- … -->` (태그용). 파일 헤더 `/* */`·문서 `///` 도 엔진이 제거 |

## 설정

- `nwiki.formatOnSave` (기본 true)
- `nwiki.formatOnNewline` (기본 false)
- `nwiki.buildOnSave` (기본 true)
- `nwiki.openOutputAfterBuild` (기본 true)
- `nwiki.previewAfterBuild` (기본 true)
- `nwiki.pythonPath` (기본 `python3`)

## 명령 팔레트

- `nwiki: Build File`
- `nwiki: Open Build Output`
- `nwiki: Preview Build Output`
- `nwiki: Format Document`
- `nwiki: Format Tag to Multiple Lines` (`Ctrl+M`)
