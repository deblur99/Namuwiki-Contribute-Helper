"""CommonFrame enum mapping → namuwiki include() payloads."""

from __future__ import annotations

from .ast import CallExpr, CallStmt, EnumRef
from .errors import NwikiError

# case name → 틀 문서명 (틀: 제외)
COMMON_FRAME_NAMES: dict[str, str] = {
    "spoiler": "스포일러",
    "spoilerSection": "스포일러/문단",
    "spoilerPreview": "스포일러/선 연재분",
    "adult": "선정성",
    "incident": "사건사고",
    "unpublished": "미공개",
    "stub": "토막글",
    "parentDocument": "상위 문서",
    "childDocuments": "하위 문서",
    "relatedDocuments": "관련 문서",
    "detail": "상세 내용",
    "disambiguation": "다른 뜻",
    "discussion": "토론 중",
    "consensus": "토론 합의",
    "npov": "NPOV",
    "mpov": "MPOV",
    "accessRestricted": "접근 제한",
}

# bare cases: no associated values
_BARE = frozenset(
    {
        "spoiler",
        "spoilerSection",
        "adult",
        "incident",
        "unpublished",
        "stub",
        "npov",
        "mpov",
        "accessRestricted",
    }
)

_DOC_NUMBERED = frozenset({"parentDocument", "childDocuments", "relatedDocuments", "disambiguation", "consensus"})


def escape_include_value(s: str) -> str:
    """Escape commas for namuwiki include parameters."""
    return s.replace(",", r"\,")


def _as_strings(values: list) -> list[str]:
    out: list[str] = []
    for v in values:
        if not isinstance(v, str):
            raise NwikiError(f"CommonFrame associated value must be string, got {type(v).__name__}")
        out.append(v)
    return out


def normalize_frame_payload(stmt: CallStmt) -> tuple[str, list[str]]:
    """
    Returns (frame_case_or_empty, associated_string_args).
    frame_case_or_empty empty means first arg is a plain string title.
    """
    if not stmt.args:
        raise NwikiError(f"{stmt.name}() requires an argument")

    first = stmt.args[0]
    rest = list(stmt.args[1:])

    # associated-call: .discussion("사유")
    if isinstance(first, CallExpr) and first.name in COMMON_FRAME_NAMES:
        if rest:
            raise NwikiError(f"{stmt.name}: unexpected args after associated-call .{first.name}(...)")
        return first.name, _as_strings(first.args)

    # bare enum: .spoiler  or flat .relatedDocuments, "A", "B"
    if isinstance(first, EnumRef) and first.name in COMMON_FRAME_NAMES:
        return first.name, _as_strings(rest)

    # plain string title
    if isinstance(first, str):
        if rest:
            raise NwikiError(f"{stmt.name}: string frame title cannot take extra args (use CommonFrame)")
        return "", [first]

    raise NwikiError(f"{stmt.name}: expected string or CommonFrame, got {type(first).__name__}")


def build_include_macro(stmt: CallStmt) -> str:
    """Serialize include / includeFrame CallStmt to [include(...)]."""
    case, assoc = normalize_frame_payload(stmt)

    if case == "":
        title = assoc[0]
        if stmt.name == "includeFrame":
            if not title.startswith("틀:"):
                title = f"틀:{title}"
        return f"[include({title})]"

    frame_title = COMMON_FRAME_NAMES[case]
    wiki_title = f"틀:{frame_title}"

    if case in _BARE:
        if assoc:
            raise NwikiError(f"CommonFrame .{case} does not take associated values")
        return f"[include({wiki_title})]"

    if case == "parentDocument":
        if len(assoc) > 1:
            raise NwikiError("parentDocument takes at most one document name")
        if not assoc:
            return f"[include({wiki_title})]"
        return f"[include({wiki_title}, 문서명1={escape_include_value(assoc[0])})]"

    if case in ("childDocuments", "relatedDocuments"):
        if not assoc:
            raise NwikiError(f".{case} requires at least one document name")
        parts = [wiki_title] + [
            f"문서명{i}={escape_include_value(a)}" for i, a in enumerate(assoc, start=1)
        ]
        return "[include(" + ", ".join(parts) + ")]"

    if case == "detail":
        if len(assoc) != 1:
            raise NwikiError(".detail requires exactly one document name")
        return f"[include({wiki_title}, 문서명={escape_include_value(assoc[0])})]"

    if case == "discussion":
        if len(assoc) != 1:
            raise NwikiError(".discussion requires exactly one reason string")
        return f"[include({wiki_title}, 토론사유={escape_include_value(assoc[0])})]"

    if case == "spoilerPreview":
        if len(assoc) != 2:
            raise NwikiError(".spoilerPreview requires (작품명, 화수)")
        return (
            f"[include({wiki_title}, "
            f"작품명={escape_include_value(assoc[0])}, "
            f"화수={escape_include_value(assoc[1])})]"
        )

    if case in ("disambiguation", "consensus"):
        if not assoc:
            raise NwikiError(f".{case} requires at least one string")
        key = "문서명" if case == "disambiguation" else "합의사항"
        parts = [wiki_title] + [
            f"{key}{i}={escape_include_value(a)}" for i, a in enumerate(assoc, start=1)
        ]
        return "[include(" + ", ".join(parts) + ")]"

    raise NwikiError(f"unhandled CommonFrame .{case}")
