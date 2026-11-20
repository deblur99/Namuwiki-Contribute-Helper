"""Attribute value and ${} expression parsing."""

from __future__ import annotations

from .ast import CallExpr, EnumRef, InterpPart, InterpString, MemberAccess
from .errors import NwikiError


def skip_ws(s: str, i: int) -> int:
    while i < len(s) and s[i] in " \t\r\n":
        i += 1
    return i


def parse_string(s: str, i: int) -> tuple[str, int]:
    if i >= len(s) or s[i] not in "\"'":
        raise NwikiError("expected string", index=i)
    quote = s[i]
    i += 1
    out: list[str] = []
    while i < len(s) and s[i] != quote:
        if s[i] == "\\" and i + 1 < len(s):
            out.append(s[i + 1])
            i += 2
            continue
        out.append(s[i])
        i += 1
    if i >= len(s):
        raise NwikiError("unterminated string", index=i)
    return "".join(out), i + 1


def parse_ident(s: str, i: int) -> tuple[str, int]:
    if i >= len(s) or not (s[i].isalpha() or s[i] == "_"):
        raise NwikiError("expected identifier", index=i)
    j = i + 1
    while j < len(s) and (s[j].isalnum() or s[j] in "_-"):
        j += 1
    return s[i:j], j


def parse_number(s: str, i: int) -> tuple[int | float, int]:
    j = i
    if j < len(s) and s[j] in "+-":
        j += 1
    start = j
    while j < len(s) and s[j].isdigit():
        j += 1
    if j < len(s) and s[j] == ".":
        j += 1
        while j < len(s) and s[j].isdigit():
            j += 1
        return float(s[i:j]), j
    if start == j:
        raise NwikiError("expected number", index=i)
    return int(s[i:j]), j


def parse_enum_or_member(s: str, i: int) -> tuple[EnumRef | CallExpr, int]:
    """Parse .name or .name(args)."""
    i = skip_ws(s, i)
    if i >= len(s) or s[i] != ".":
        raise NwikiError("expected '.' enum", index=i)
    i += 1
    name, i = parse_ident(s, i)
    i = skip_ws(s, i)
    if i < len(s) and s[i] == "(":
        call, i = parse_call_args(s, i, name)
        return call, i
    return EnumRef(name=name), i


def parse_call_args(s: str, i: int, name: str) -> tuple[CallExpr, int]:
    if s[i] != "(":
        raise NwikiError("expected '('", index=i)
    i += 1
    args: list = []
    kwargs: dict = {}
    i = skip_ws(s, i)
    if i < len(s) and s[i] == ")":
        return CallExpr(name=name, args=args, kwargs=kwargs), i + 1

    while True:
        i = skip_ws(s, i)
        # labeled: ident=value | ident: value  OR bare value / nested call
        if i < len(s) and (s[i].isalpha() or s[i] == "_"):
            ident, j = parse_ident(s, i)
            j2 = skip_ws(s, j)
            if j2 < len(s) and s[j2] == "=":
                i = j2 + 1
                val, i = parse_value(s, i)
                kwargs[ident] = val
            elif j2 < len(s) and s[j2] == ":" and not (
                j2 + 1 < len(s) and s[j2 + 1] == "/"
            ):
                # Date(year: 1994) style
                i = j2 + 1
                val, i = parse_value(s, i)
                kwargs[ident] = val
            else:
                val, i = parse_value(s, i)
                args.append(val)
        else:
            val, i = parse_value(s, i)
            args.append(val)
        i = skip_ws(s, i)
        if i < len(s) and s[i] == ",":
            i += 1
            continue
        if i < len(s) and s[i] == ")":
            return CallExpr(name=name, args=args, kwargs=kwargs), i + 1
        raise NwikiError("expected ',' or ')' in call", index=i)


def parse_value(s: str, i: int):
    i = skip_ws(s, i)
    if i >= len(s):
        raise NwikiError("unexpected end in value", index=i)

    if s[i] in "\"'":
        return parse_string(s, i)

    if s[i] == ".":
        return parse_enum_or_member(s, i)

    if s[i] == "[":
        return parse_list(s, i)

    if s[i].isdigit() or (s[i] in "+-" and i + 1 < len(s) and s[i + 1].isdigit()):
        return parse_number(s, i)

    if s.startswith("true", i) and _end_ident(s, i + 4):
        return True, i + 4
    if s.startswith("false", i) and _end_ident(s, i + 5):
        return False, i + 5

    # CallExpr / MemberAccess: Ident(...) or Ident.Ident
    if s[i].isalpha() or s[i] == "_":
        name, j = parse_ident(s, i)
        j = skip_ws(s, j)
        if j < len(s) and s[j] == "(":
            return parse_call_args(s, j, name)
        parts = [name]
        while j < len(s) and s[j] == ".":
            # props.name — not .enum at value root after ident
            j += 1
            nxt, j = parse_ident(s, j)
            parts.append(nxt)
            j = skip_ws(s, j)
        if len(parts) > 1:
            return MemberAccess(parts=parts), j
        return EnumRef(name=name), j

    raise NwikiError(f"unexpected value start {s[i]!r}", index=i)


def parse_list(s: str, i: int) -> tuple[list, int]:
    if s[i] != "[":
        raise NwikiError("expected '['", index=i)
    i += 1
    items: list = []
    i = skip_ws(s, i)
    if i < len(s) and s[i] == "]":
        return items, i + 1
    while True:
        val, i = parse_value(s, i)
        items.append(val)
        i = skip_ws(s, i)
        if i < len(s) and s[i] == ",":
            i += 1
            continue
        if i < len(s) and s[i] == "]":
            return items, i + 1
        raise NwikiError("expected ',' or ']' in list", index=i)


def _end_ident(s: str, i: int) -> bool:
    return i >= len(s) or not (s[i].isalnum() or s[i] == "_")


def parse_attr_value(s: str, i: int):
    """Parse a full attribute value starting at i (no leading =)."""
    return parse_value(s, i)


def parse_interp_string_content(content: str) -> InterpString | str:
    """Split a quoted string that may contain ${...} into InterpString or plain str."""
    if "${" not in content:
        return content
    parts: list[InterpPart] = []
    i = 0
    while i < len(content):
        start = content.find("${", i)
        if start < 0:
            parts.append(InterpPart(kind="literal", value=content[i:]))
            break
        if start > i:
            parts.append(InterpPart(kind="literal", value=content[i:start]))
        j = start + 2
        depth = 0
        while j < len(content):
            if content[j] == "{":
                depth += 1
            elif content[j] == "}":
                if depth == 0:
                    break
                depth -= 1
            j += 1
        if j >= len(content) or content[j] != "}":
            raise NwikiError("unterminated ${...} in string")
        inner = content[start + 2 : j]
        expr, _ = parse_value(inner, 0)
        parts.append(InterpPart(kind="expr", value=expr))
        i = j + 1
    if len(parts) == 1 and parts[0].kind == "literal":
        return parts[0].value
    return InterpString(parts=parts)
