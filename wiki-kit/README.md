# wiki-kit (초안)

## 왜 하는가

문서를 **가끔 수정**하거나, **기존 구조를 바꾸**거나, **새로 만들** 때가 있다.  
그때 나무위키 raw 문법은:

1. **실수하기 쉽다** — 표·각주·색·중첩 `{{{` 등이 한곳에서만 깨져도 전체가 망가진다.
2. **같은 패턴이 여기저기** 있어서, 구조를 바꾸려면 여러 곳을 일일이 고쳐야 한다.

그래서 자주 쓰는 덩어리를 **컴포넌트**로 두고, 문서에서는 그걸 조합만 한다.  
한 컴포넌트를 고치면 그걸 쓰는 문서에 한꺼번에 반영되고, 빌드·검증으로 raw 실수를 줄인 뒤, 위키에는 **완성된 날것 코드만** 붙여넣는다.

## 무엇을 하는가

| 단계 | 역할 |
|------|------|
| 구성 | `components/` · `templates/` 에 재사용 단위 정의, `pages/` 에서 props로 조합 |
| 검증 | `validate` — props 스키마, 未知 컴포넌트, designSystem 키, 태그 짝 |
| 빌드 | `build` — `outputs/*.md` 생성 → 위키 편집기 붙여넣기 |

기존 `{프로젝트}/templates` + `${designSystem.*}` 치환보다 한 단계 위다.  
레거시 `scripts/build.py`(김마리 등)와 **병행**하고, 안정화 후 통합을 목표로 한다.

## 컴포넌트 설계 원칙 (표·복잡한 문법)

**복잡한 풀 구성을 먼저** 두고, **간단한 작성용은 그걸 간편화한 래퍼**로 둔다.

```text
풀 구성 (능력치 전부)     Table / Cell …  colSpan, width, bg, rowBg, borderColor, hoist…
        ↑ 감싸서 줄임
간편 구성 (일상 작성)     Infobox / InfoRow / AlbumCard …  자주 쓰는 기본값·배치만
```

- 풀 구성: 나무위키 표가 할 수 있는 것을 빠짐없이(또는 거의) 표현. 예외·난이도 높은 문서도 여기로 버팀.
- 간편 구성: 풀 구성을 **호출만** 하고, props·기본값을 줄여 “여기저기 안 고치게” 만듦.
- 간편 쪽이 새 raw를 직접 뿜지 않게 해서, 문법 수정은 풀 구성 한곳(+빌더)에만 모은다.

문서 난이도 순서(쉬움 → 라우팅 → 어려움)로 **분리 연습**할 때도,  
구현 축은 “작은 것부터 쌓기”가 아니라 **풀 → 간편화**다.

## 구조

```
wiki-kit/
├── engine/           # 로더 · 태그 파서 · 검증 · 렌더 · CLI
├── components/       # *.ncomp  — 원자/조합 컴포넌트
├── templates/        # *.ntpl   — 문서 골격 (컴포넌트 조합)
├── pages/            # *.json   — 실제 문서 인스턴스 (template + props)
├── data/designSystem.json
├── scripts/build.py
└── outputs/          # 빌드 결과 (gitignore)
```

## 문법 요약

**목표 작성 스타일 (JSX에 가깝게):**

```
<InfoBox title="김마리">
  <InfoRow label="본명" value="김현지" />
  <InfoRow label="출생" value="1994-05-06" />
</InfoBox>
```

현재 엔진 초안은 나무위키 `<#색>` 등과 겹치지 않으려고 `[@Infobox]...[/@Infobox]` 형태를 쓰고 있다. 컴포넌트 목록·변환 규칙은 따로 정리한 뒤 JSX 스타일로 맞출 예정.

| 용도 | 현재 초안 | 목표 |
|------|-----------|------|
| 디자인 토큰 | `${designSystem.accentColor}` | 동일 또는 별도 결정 |
| props | `${props.title}` | 동일 또는 `{title}` 등 |
| 컴포넌트 | `[@InfoRow label="본명" /]` | `<InfoRow label="본명" />` |

파일 상단 frontmatter로 `name`, `kind`, `props` 스키마를 선언합니다.

## 명령

```bash
cd wiki-kit

# 등록된 단위 목록
python3 scripts/build.py list

# 스키마·참조 검증
python3 scripts/build.py validate

# pages → outputs 빌드 (내부에서 validate 선행)
python3 scripts/build.py build
python3 scripts/build.py build demo-intro
```

## 새 컴포넌트 만들기

1. `components/MyBox.ncomp` 추가 (frontmatter + 본문)
2. 다른 컴포넌트/템플릿에서 `[@MyBox ... /]` 로 사용
3. `validate` → `build` → `outputs/` 확인 후 위키 붙여넣기

템플릿은 컴포넌트를 모아 문서 골격을 만들고, `pages/*.json`이 props만 바꿔 여러 문서를 뽑는 구조입니다.

## 데모

- `pages/demo-intro.json` → `ArtistIntro` 템플릿 (인포박스 조합)
- `pages/demo-nav.json` → `ArtistNavFrame` (둘러보기 틀)

## 아직 초안인 것

- `IfTruthy` 만 엔진 내장 조건부 (일반식/비교 없음)
- props 타입은 string 중심; 배열 map은 미구현
- frontmatter는 최소 YAML (중첩 props 정도만)
- 레거시 `김마리/` 프로젝트와 자동 연동 없음
