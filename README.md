# Namuwiki Contribute Helper

나무위키 문서를 **템플릿 + 디자인 토큰**으로 관리하고, 빌드 결과물을 위키 편집기에 붙여넣기 위한 작은 헬퍼입니다.

아티스트(또는 주제)마다 하위 프로젝트 폴더를 두고, 공통 빌드 스크립트는 저장소 루트에서 공유합니다.

## 구조

```
Namuwiki-Contribute-Helper/
├── scripts/build.py      # 공통 빌드
├── README.md
├── RULES.md
└── 김마리/                 # 프로젝트 예시
    ├── data/             # designSystem.json, urls.json
    ├── templates/        # 편집용 원본 (${designSystem.*} 토큰)
    └── outputs/          # 위키에 붙여넣을 결과 (gitignore)
```

새 프로젝트는 `김마리/`와 같이 `{이름}/data|templates|outputs`만 추가하면 됩니다.

## 빌드

```bash
# 특정 프로젝트
python3 scripts/build.py 김마리

# templates + data/designSystem.json 이 있는 프로젝트 전부
python3 scripts/build.py
```

1. `{프로젝트}/templates/` 또는 `data/designSystem.json`을 수정한다.
2. 위 명령으로 빌드한다.
3. `{프로젝트}/outputs/` 파일을 복사 → 나무위키 편집기 붙여넣기 → 미리보기 후 저장.

상세 규칙은 [RULES.md](RULES.md)를 따른다.

## 예시 프로젝트: 김마리

| 위키 문서 | templates / outputs |
|-----------|---------------------|
| [김마리(가수)](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)) | `소개.md` |
| [음반 목록](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EC%9D%8C%EB%B0%98%20%EB%AA%A9%EB%A1%9D) | `음반목록.md` |
| [공연 목록](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EA%B3%B5%EC%97%B0%20%EB%AA%A9%EB%A1%9D) | `공연목록.md` |
| [응원법](https://namu.wiki/w/%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)/%EC%9D%91%EC%9B%90%EB%B2%95) | `응원법.md` |
| [틀:김마리(가수)](https://namu.wiki/w/%ED%8B%80:%EA%B9%80%EB%A7%88%EB%A6%AC(%EA%B0%80%EC%88%98)) | `틀.md` |

위키 URL은 `김마리/data/urls.json`에도 있습니다.

### 디자인 토큰 (`김마리/data/designSystem.json`)

| 키 | 용도 |
|----|------|
| `accentColor` | 표 테두리·헤더·강조 배경 |
| `white` / `whiteShort` | 흰 배경·짧은 `#fff` |
| `black` | 본문/가사 강조 글자색 |
| `tableBgAlbum` | 음반 표 본문 (`#EEE,#333`) |
| `tableBgIntro` | 소개 인포박스 배경 |
| `lyricHighlightBg` | 응원법 따라 부르기 하이라이트 |
| `profileImage` | 소개 프로필 이미지 파일명 |

templates에서는 `${designSystem.accentColor}`처럼 참조합니다.

## 요구 사항

- Python 3.9+ (표준 라이브러리만 사용)
