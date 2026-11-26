"""Parse .nwiki source into Document AST."""

from __future__ import annotations

import re

from .ast import CallStmt, Document, Element, EnumRef, PropDecl
from .errors import NwikiError
from .expr import (
    parse_attr_value,
    parse_call_args,
    parse_ident,
    parse_interp_string_content,
    parse_string,
    skip_ws,
)


def _blank_span(source: str, start: int, end: int) -> str:
    """Replace [start, end) with spaces, keeping newlines so indices/lines stay aligned."""
    return "".join("\n" if source[j] == "\n" else " " for j in range(start, end))


def strip_comments(source: str) -> str:
    """Blank out /* */, <!-- -->, /// doc lines, and // line comments (non-nested).

    Comment text is replaced with spaces (newlines kept) so cleaned indices match
    the original source. Strings (\"…\" / '…') are left intact so URLs like http://
    survive. /// is blanked as a whole line before // matching.
    """
    out: list[str] = []
    i = 0
    n = len(source)
    in_dq = False
    in_sq = False
    while i < n:
        ch = source[i]

        if in_dq:
            out.append(ch)
            if ch == '"' and (i == 0 or source[i - 1] != "\\"):
                in_dq = False
            i += 1
            continue
        if in_sq:
            out.append(ch)
            if ch == "'" and (i == 0 or source[i - 1] != "\\"):
                in_sq = False
            i += 1
            continue

        if ch == '"':
            in_dq = True
            out.append(ch)
            i += 1
            continue
        if ch == "'":
            in_sq = True
            out.append(ch)
            i += 1
            continue

        if _at_line_start(source, i) and _is_doc_comment_line(source, i):
            start = i
            while i < n and source[i] != "\n":
                i += 1
            out.append(_blank_span(source, start, i))
            continue

        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise NwikiError("unterminated /* comment", index=i)
            end += 2
            out.append(_blank_span(source, i, end))
            i = end
            continue

        if source.startswith("<!--", i):
            end = source.find("-->", i + 4)
            if end < 0:
                raise NwikiError("unterminated <!-- comment", index=i)
            end += 3
            out.append(_blank_span(source, i, end))
            i = end
            continue

        # // line comment (not /// — already handled). Require start or whitespace.
        if source.startswith("//", i) and not source.startswith("///", i):
            if i == 0 or source[i - 1] in " \t\n":
                start = i
                while i < n and source[i] != "\n":
                    i += 1
                out.append(_blank_span(source, start, i))
                continue

        out.append(ch)
        i += 1
    return "".join(out)


def _at_line_start(source: str, i: int) -> bool:
    return i == 0 or source[i - 1] == "\n"


def _is_doc_comment_line(source: str, i: int) -> bool:
    j = i
    while j < len(source) and source[j] in " \t":
        j += 1
    return source.startswith("///", j)


_TEMPLATE = re.compile(r"<template>(.*?)</template>", re.DOTALL | re.IGNORECASE)
_SCRIPT_OPEN = re.compile(r"<script\b", re.IGNORECASE)
_CALL_HEAD = re.compile(
    r"\b(category|include|includeFrame|import|document|frame)\s*\("
)
_IMPORT_FROM = re.compile(
    r"\bimport\s+([A-Za-z_][\w]*)\s+from\s+"
)
_EXTENSION_REJECT = re.compile(r"\bextension\b")
_PROPS_BLOCK = re.compile(
    r"\bprops\s*\{([^{}]*)\}",
    re.DOTALL,
)


def reject_extension(cleaned: str) -> None:
    """extension was removed — tokens live in JSON via import … from."""
    blocked = _blocked_ranges(cleaned)
    for m in _EXTENSION_REJECT.finditer(cleaned):
        if _in_blocked(m.start(), blocked):
            continue
        raise NwikiError(
            "extension is removed; put keys in a .json file and "
            'use import Name from "….json"',
            index=m.start(),
        )


def parse_props_block(cleaned: str) -> dict[str, PropDecl]:
    """Parse top-level `props { name: required, age }` (values are always String).

    - `name: required` → required
    - bare `age` → optional
    - legacy `name: String` / `opt: String?` → error with guidance
    """
    blocked = _blocked_ranges(cleaned)
    decls: dict[str, PropDecl] = {}
    for m in _PROPS_BLOCK.finditer(cleaned):
        if _in_blocked(m.start(), blocked):
            continue
        block = m.group(1)
        i = 0
        while True:
            i = skip_ws(block, i)
            if i >= len(block):
                break
            name, i = parse_ident(block, i)
            i = skip_ws(block, i)
            optional = True
            if i < len(block) and block[i] == ":":
                i += 1
                i = skip_ws(block, i)
                if i >= len(block):
                    raise NwikiError(
                        f"prop {name}: expected 'required' after ':' "
                        f"(or use bare '{name}' for optional)",
                        index=m.start(1) + i,
                    )
                marker, i = parse_ident(block, i)
                if marker == "required":
                    optional = False
                else:
                    raise NwikiError(
                        f"prop {name}: use '{name}: required' or bare '{name}' "
                        f"(values are always String; got {marker!r})",
                        index=m.start(1) + i - len(marker),
                    )
                if i < len(block) and block[i] == "?":
                    raise NwikiError(
                        f"prop {name}: '?' is removed; use bare '{name}' for optional",
                        index=m.start(1) + i,
                    )
            if name in decls:
                raise NwikiError(f"duplicate prop declaration {name!r}")
            decls[name] = PropDecl(name=name, optional=optional)
            i = skip_ws(block, i)
            if i < len(block) and block[i] == ",":
                i += 1
                continue
            if i < len(block) and block[i] == ";":
                i += 1
    return decls


def _blocked_ranges(cleaned: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for m in _TEMPLATE.finditer(cleaned):
        ranges.append((m.start(), m.end()))
    return ranges


def _in_blocked(pos: int, ranges: list[tuple[int, int]]) -> bool:
    return any(a <= pos < b for a, b in ranges)


def parse_import_from_stmts(cleaned: str) -> list[CallStmt]:
    """Parse `import Name from \"path\"` outside <template>."""
    blocked = _blocked_ranges(cleaned)
    stmts: list[CallStmt] = []
    i = 0
    while True:
        m = _IMPORT_FROM.search(cleaned, i)
        if not m:
            break
        if _in_blocked(m.start(), blocked):
            i = m.end()
            continue
        binding = m.group(1)
        j = skip_ws(cleaned, m.end())
        if j >= len(cleaned) or cleaned[j] not in "\"'":
            raise NwikiError(
                'expected string path after import … from',
                index=j,
            )
        path, j = parse_string(cleaned, j)
        stmts.append(
            CallStmt(name="import", args=[path], kwargs={"as": binding})
        )
        i = j
    return stmts


def parse_top_level_calls(cleaned: str) -> list[CallStmt]:
    """Parse category/include/…/import(…) call form outside <template>."""
    blocked = _blocked_ranges(cleaned)
    stmts: list[CallStmt] = []
    i = 0
    while True:
        m = _CALL_HEAD.search(cleaned, i)
        if not m:
            break
        if _in_blocked(m.start(), blocked):
            i = m.end()
            continue
        # Skip `import Name from` — handled by parse_import_from_stmts
        if m.group(1) == "import":
            before = cleaned[m.start() : m.end()]
            # import( — OK; but if this match is somehow from-form, skip
            pass
        name = m.group(1)
        paren = m.end() - 1
        call, j = parse_call_args(cleaned, paren, name)
        args = list(call.args)
        if name == "import" and len(args) == 1 and isinstance(args[0], EnumRef):
            args = [args[0].name]
        stmts.append(CallStmt(name=name, args=args, kwargs=dict(call.kwargs)))
        i = j
    return stmts


def parse_document(source: str, *, path: str | None = None) -> Document:
    from .docpath import bind_document_name

    cleaned = strip_comments(source)

    sm = _SCRIPT_OPEN.search(cleaned)
    if sm:
        raise NwikiError(
            "<script> is removed; use top-level import/props and <template>",
            index=sm.start(),
        )

    tm = _TEMPLATE.search(cleaned)
    if not tm:
        raise NwikiError("missing required <template>…</template>")

    reject_extension(cleaned)

    doc = Document(path=path)
    doc.stmts = parse_import_from_stmts(cleaned)
    doc.stmts.extend(parse_top_level_calls(cleaned))
    doc.prop_decls = parse_props_block(cleaned)

    raw_body = tm.group(1)
    body = raw_body.strip()
    body_offset = tm.start(1) + (len(raw_body) - len(raw_body.lstrip()))
    try:
        elements, idx = parse_element_list(body, 0)
    except NwikiError as e:
        raise _rebase_error(e, body_offset) from e
    idx = skip_ws(body, idx)
    if idx < len(body):
        raise NwikiError(
            "trailing content in <template>",
            index=body_offset + idx,
        )
    _rebase_attr_starts(elements, body_offset)
    doc.template = elements

    bind_document_name(doc)
    return doc


def _rebase_attr_starts(elements: list[Element], offset: int) -> None:
    for el in elements:
        el.attr_starts = {k: v + offset for k, v in el.attr_starts.items()}
        _rebase_attr_starts(el.children, offset)


def _rebase_error(err: NwikiError, offset: int) -> NwikiError:
    """Shift a body-relative NwikiError.index to a full-source absolute index."""
    if err.index is None:
        return err
    msg = err.args[0] if err.args else str(err)
    if isinstance(msg, str):
        suf = f" (at {err.index})"
        if msg.endswith(suf):
            msg = msg[: -len(suf)]
    return NwikiError(msg, index=offset + err.index)


def parse_element_list(s: str, i: int) -> tuple[list[Element], int]:
    elements: list[Element] = []
    while True:
        i = skip_ws(s, i)
        if i >= len(s):
            break
        if s.startswith("</", i):
            break
        if s[i] != "<":
            raise NwikiError(f"expected tag, got {s[i]!r}", index=i)
        el, i = parse_element(s, i)
        elements.append(el)
    return elements, i


def parse_element(s: str, i: int) -> tuple[Element, int]:
    if s[i] != "<":
        raise NwikiError("expected '<'", index=i)
    i += 1
    if i < len(s) and s[i] == "/":
        raise NwikiError("unexpected close tag", index=i)

    name, i = _parse_tag_name(s, i)
    attrs: dict = {}
    attr_starts: dict[str, int] = {}
    i = skip_ws(s, i)
    while i < len(s) and s[i] not in "/>":
        if not (s[i].isalpha() or s[i] == "_"):
            raise NwikiError("expected attribute name", index=i)
        key_start = i
        while i < len(s) and (s[i].isalnum() or s[i] in "_-"):
            i += 1
        key = s[key_start:i]
        i = skip_ws(s, i)
        if i >= len(s) or s[i] != "=":
            raise NwikiError(
                f"expected '=' after attr {key}",
                index=key_start,
            )
        i += 1
        i = skip_ws(s, i)
        value_start = i
        if i < len(s) and s[i] in "\"'":
            raw, i = parse_string(s, i)
            val = parse_interp_string_content(raw)
        else:
            val, i = parse_attr_value(s, i)
        attrs[key] = val
        attr_starts[key] = value_start
        i = skip_ws(s, i)

    if i < len(s) and s.startswith("/>", i):
        return (
            Element(
                name=name,
                attrs=attrs,
                children=[],
                self_closing=True,
                attr_starts=attr_starts,
            ),
            i + 2,
        )

    if i < len(s) and s[i] == ">":
        i += 1
        if name.lower() == "br":
            return (
                Element(
                    name="br",
                    attrs=attrs,
                    children=[],
                    self_closing=True,
                    attr_starts=attr_starts,
                ),
                i,
            )
        children, i = parse_element_list(s, i)
        i = skip_ws(s, i)
        close = f"</{name}>"
        if not s.startswith(close, i):
            raise NwikiError(f"expected {close}", index=i)
        return (
            Element(
                name=name,
                attrs=attrs,
                children=children,
                attr_starts=attr_starts,
            ),
            i + len(close),
        )

    raise NwikiError("malformed tag", index=i)


def _parse_tag_name(s: str, i: int) -> tuple[str, int]:
    if i >= len(s) or not (s[i].isalpha() or s[i] == "_"):
        raise NwikiError("expected tag name", index=i)
    j = i + 1
    while j < len(s) and (s[j].isalnum() or s[j] in "_-"):
        j += 1
    return s[i:j], j


def parse_file(path: str, text: str | None = None) -> Document:
    from pathlib import Path

    p = Path(path)
    source = text if text is not None else p.read_text(encoding="utf-8")
    return parse_document(source, path=str(p))
