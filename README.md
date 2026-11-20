# Namuwiki Contribute Helper

나무위키 문서를 **템플릿·컴포넌트**로 관리하고, 빌드 결과(raw)를 위키 편집기에 붙여넣기 위한 헬퍼입니다.

두 갈래가 병행됩니다.

| 경로 | 역할 |
|------|------|
| [`wiki-kit/`](wiki-kit/README.md) | **권장** — `.nwiki` 조립 → 검증 → `outputs/*.md` |
| `김마리/` + 루트 `scripts/build.py` | 레거시 — `${designSystem.*}` 토큰 치환 |

상세 규칙은 [RULES.md](RULES.md)(레거시 토큰)와 [wiki-kit/docs/SPEC.nwiki](wiki-kit/docs/SPEC.nwiki)(nwiki 문법)를 따른다.

## 빠른 시작 (wiki-kit / nwiki)

```bash
cd wiki-kit
python3 scripts/build.py build examples/introduce.nwiki
# → outputs/introduce.md

python3 -m unittest tests/test_nwiki_introduce.py
```

에디터 지원:

```bash
cd wiki-kit/vscode-nwiki && npm install && npm run compile
```

저장소에서 **Run and Debug → Run nwiki Extension** (`Cmd+F5` 권장).  
기능 목록은 [wiki-kit/vscode-nwiki/README.md](wiki-kit/vscode-nwiki/README.md).

## 구조

```
Namuwiki-Contribute-Helper/
├── wiki-kit/                 # nwiki 엔진 · 예제 · VS Code 확장
│   ├── docs/SPEC.nwiki
│   ├── examples/             # introduce, ProfileTable, Box, CommonFrame …
│   ├── engine/nwiki/         # 파서 · 렌더 · CommonFrame · import
│   ├── vscode-nwiki/         # 자동완성 · 진단 · 프리뷰 · 태그 닫기
│   └── tests/
├── scripts/build.py          # 레거시 토큰 빌드
├── 김마리/                   # 레거시 프로젝트 예시
├── RULES.md
└── README.md
```

## 레거시 빌드 (김마리)

```bash
python3 scripts/build.py 김마리
```

1. `김마리/templates/` 또는 `data/designSystem.json` 수정  
2. 빌드 → `김마리/outputs/` 복사 → 위키 붙여넣기  

| 위키 문서 | templates |
|-----------|-----------|
| [김마리(가수)](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)) | `소개.md` |
| [음반 목록](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EC%9D%8C%EB%B0%98%20%EB%AA%A9%EB%A1%9D) | `음반목록.md` |
| [공연 목록](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EA%B3%B5%EC%97%B0%20%EB%AA%A9%EB%A1%9D) | `공연목록.md` |
| [응원법](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EC%9D%91%EC%9B%90%EB%B2%95) | `응원법.md` |
| [틀:김마리(가수)](https://namu.wiki/w/%ED%8B%80:%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)) | `틀.md` |

## 요구 사항

- Python 3.9+ (표준 라이브러리)
- 확장 개발 시 Node.js 20+ (`wiki-kit/vscode-nwiki`)
