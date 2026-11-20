# nwiki (VS Code / Cursor)

`.nwiki` 언어 지원 확장 — 자동완성, 스니펫, 문법 진단, Quick Fix, 정렬, 저장 시 빌드.

## 설치 (개발)

1. `wiki-kit/vscode-nwiki`에서:

```bash
cd wiki-kit/vscode-nwiki
npm install
npm run compile
```

2. Cursor / VS Code에서 이 저장소를 연 뒤 **Run and Debug → “Run nwiki Extension”**  
   (`Cmd+F5` / Run Without Debugging 권장. Cursor에서 `F5` 디버그는 Extension Host가 첫 줄에서 멈춰 명령이 안 먹을 수 있음)

```bash
# 또는 CLI로 개발 모드 로드
cursor --extensionDevelopmentPath=./wiki-kit/vscode-nwiki .
```

3. **Extension Development Host** 새 창에서 `.nwiki`를 연다 (언어 모드 `nwiki`).  
   Output 채널 `nwiki`에 `nwiki extension activated`가 보이면 로드된 것.

## 기능

| 기능 | 설명 |
|------|------|
| 자동완성 | 태그·속성·`Box`/`Folding`/`Heading`/`Badge`·`category`/`include`/`includeFrame`/`import` |
| `.` 멤버 완성 | `includeFrame(.` → CommonFrame, `Type.` → init/정적, 값.` → 인스턴스, `attr=` → 기대 enum |
| `///` 문서 · 호버 | `///` 마크다운 문서 주석 → 식별자 호버/자동완성 툴팁. Enter 시 같은 열에 `/// ` 연속 |
| 스니펫 | `tbl`, `tr`, `tc`, `tx`, `lk`, `img`, `cmt`, `cat` … |
| Emmet | `nwiki`에서 제외 (HTML 오제안 방지). Cursor Tab도 `nwiki` 비활성 → 확장 카탈로그 완성만 사용 |
| 진단 | 빨간 밑줄 + hover (파서·오타·알 수 없는 태그) |
| Quick Fix | `Ctrl+.` / `Cmd+.` |
| 정렬 | 저장 시(기본), `Ctrl+Alt+L` / `Cmd+Option+L`, 선택적 개행 시 |
| 빌드 | 저장 시 `python3 scripts/build.py build <file>` → `outputs/<stem>.md` 열기 |
| 프리뷰 | 빌드 후 나무위키 raw 근사 HTML Webview (표·문단·wiki style·접기 등) |
| 태그 닫기 | `/` → `/>` (속성 있는 태그는 `<Tag \| />` 슬롯, ↑↓면 여백 취소) · `>` → `></Tag>`, Enter 시 줄바꿈 확장 |
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
