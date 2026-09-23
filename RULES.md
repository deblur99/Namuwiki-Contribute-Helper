# 수정 규칙

위키에 올리는 문서는 항상 **`{프로젝트}/outputs/`** 기준이다. `templates/`는 소스이고, 빌드 전에는 위키에 그대로 붙이지 않는다.

## 1. 소스와 결과물

| 경로 | 역할 |
|------|------|
| `{프로젝트}/templates/*.md` | 편집 원본. `${designSystem.*}` 토큰을 둘 수 있다. |
| `{프로젝트}/data/designSystem.json` | 색상·프로필 이미지 등 토큰 값. |
| `{프로젝트}/outputs/*.md` | 빌드 결과. 위키 편집기에 붙여넣는다. |
| `scripts/build.py` | 공통 빌드 (레포 루트) |

- **templates를 빌드 결과로 덮어쓰지 않는다.**
- `outputs/`는 gitignore 대상이다. 로컬에서 빌드해 사용한다.
- 프로젝트 예: `김마리/`

## 2. 토큰 (`${designSystem.키}`)

- 나무위키의 `{{` / `{{{` 문법과 겹치지 않도록 **`${designSystem.키}`** 만 쓴다.
- 색상 토큰 값은 `#`를 포함한 전체 hex다.
  - 속성: `tablebordercolor=${designSystem.accentColor}`
  - 셀 배경: `<${designSystem.accentColor}>` (`<#`를 또 붙이지 않음)
  - 글자색: `{{{${designSystem.whiteShort} 텍스트}}}` (`{{{#`를 또 붙이지 않음)
- 이미지: `[[${designSystem.profileImage}|width=100%]]`
- JSON에 없는 키를 쓰면 빌드가 실패한다. 새 토큰은 해당 프로젝트의 `designSystem.json`에 먼저 추가한다.

## 3. 빌드

```bash
python3 scripts/build.py 김마리
# 또는 인자 없이 모든 프로젝트
python3 scripts/build.py
```

- 지정한(또는 발견된) 프로젝트의 `templates/`를 읽어 플레이스홀더를 치환한 뒤 `outputs/`에 같은 이름으로 저장한다.
- 치환되지 않은 `${designSystem.*}`가 남으면 오류로 중단한다.

## 4. 위키 반영

1. `{프로젝트}/outputs/`에서 해당 문서를 연다.
2. 전체 내용을 복사해 나무위키 편집기에 붙여넣는다.
3. **미리보기**로 표·각주·링크·색이 깨지지 않는지 확인한다.
4. 저장한다.

문서 URL은 `{프로젝트}/data/urls.json`을 참고한다.

## 5. 나무위키 문법 주의

- 목록: 줄 시작이 ` * 본문` (별표 앞에 공백).
- 각주: `[* 내용]` (한 쌍의 `[ ]`). `[\*`로 이스케이프하면 각주가 아니라 원문이 노출된다.
- 링크: `[[문서|표시]]` 또는 `[[url|표시]]`. 각주 안 표시명에 반각 `]`를 쓰면 각주가 중간에 끊길 수 있다.
- 문서명에 `(가수)`가 있는 링크는 각주 안에서 특히 미리보기로 확인할 것.

## 6. 작업 순서 요약

1. `{프로젝트}/templates/` 또는 `data/designSystem.json` 수정  
2. `python3 scripts/build.py {프로젝트}`  
3. `{프로젝트}/outputs/` 확인 후 위키에 붙여넣기·미리보기·저장  
