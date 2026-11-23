"""Parse .nwiki source into Document AST."""

from __future__ import annotations

import re

from .ast import CallStmt, Document, Element, EnumRef
from .errors import NwikiError
from .expr import (
    parse_attr_value,
    parse_call_args,
    parse_ident,
    parse_interp_string_content,
    parse_string,
    skip_ws,
)


def strip_comments(source: str) -> str:
    """Remove /* */, <!-- -->, and /// doc-comment lines (non-greedy, non-nested)."""
    out: list[str] = []
    i = 0
    while i < len(source):
        # /// doc line: optional indent, then /// … to EOL (not inside /* */)
        if _at_line_start(source, i) and _is_doc_comment_line(source, i):
            while i < len(source) and source[i] != "\n":
                i += 1
            # drop the line; keep newline so surrounding layout stays similar
            continue
        if source.startswith("/*", i):
            end = source.find("*/", i + 2)
            if end < 0:
                raise NwikiError("unterminated /* comment", index=i)
            i = end + 2
            continue
        if source.startswith("<!--", i):
            end = source.find("-->", i + 4)
            if end < 0:
                raise NwikiError("unterminated <!-- comment", index=i)
            i = end + 3
            continue
        out.append(source[i])
        i += 1
    return "".join(out)


def _at_line_start(source: str, i: int) -> bool:
    return i == 0 or source[i - 1] == "\n"


def _is_doc_comment_line(source: str, i: int) -> bool:
    j = i
    while j < len(source) and source[j] in " \t":
        j += 1
    return source.startswith("///", j)


_SCRIPT = re.compile(r"<script>(.*?)</script>", re.DOTALL | re.IGNORECASE)
_TEMPLATE = re.compile(r"<template>(.*?)</template>", re.DOTALL | re.IGNORECASE)
_CALL_HEAD = re.compile(r"\b(category|include|includeFrame|import)\s*\(")
_PROP_ENTRY = re.compile(r'"([^"]+)"\s*:\s*"([^"]*)"')


def parse_script_props(body: str) -> dict[str, str]:
    return {m.group(1): m.group(2) for m in _PROP_ENTRY.finditer(body)}


def _blocked_ranges(cleaned: str) -> list[tuple[int, int]]:
    ranges: list[tuple[int, int]] = []
    for rx in (_SCRIPT, _TEMPLATE):
        for m in rx.finditer(cleaned):
            ranges.append((m.start(), m.end()))
    return ranges


def _in_blocked(pos: int, ranges: list[tuple[int, int]]) -> bool:
    return any(a <= pos < b for a, b in ranges)


def parse_top_level_calls(cleaned: str) -> list[CallStmt]:
    """Parse category/include/includeFrame/import outside script/template."""
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
        name = m.group(1)
        paren = m.end() - 1
        call, j = parse_call_args(cleaned, paren, name)
        args = list(call.args)
        # import(ProfileTable) → bare ident becomes EnumRef
        if name == "import" and len(args) == 1 and isinstance(args[0], EnumRef):
            args = [args[0].name]
        stmts.append(CallStmt(name=name, args=args, kwargs=dict(call.kwargs)))
        i = j
    return stmts


def parse_document(source: str, *, path: str | None = None) -> Document:
    cleaned = strip_comments(source)
    doc = Document(path=path)
    doc.stmts = parse_top_level_calls(cleaned)

    sm = _SCRIPT.search(cleaned)
    if sm:
        script_body = sm.group(1)
        doc.script_props = parse_script_props(script_body)
        # import / category / include inside <script> (same as top-level)
        doc.stmts.extend(parse_top_level_calls(script_body))

    tm = _TEMPLATE.search(cleaned)
    if tm:
        body = tm.group(1).strip()
        elements, idx = parse_element_list(body, 0)
        idx = skip_ws(body, idx)
        if idx < len(body):
            raise NwikiError("trailing content in <template>", index=idx)
        doc.template = elements

    return doc


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

    # br / Space specials without attrs often
    name, i = _parse_tag_name(s, i)
    attrs: dict = {}
    i = skip_ws(s, i)
    while i < len(s) and s[i] not in "/>":
        # attr name
        if not (s[i].isalpha() or s[i] == "_"):
            raise NwikiError("expected attribute name", index=i)
        key_start = i
        while i < len(s) and (s[i].isalnum() or s[i] in "_-"):
            i += 1
        key = s[key_start:i]
        i = skip_ws(s, i)
        if i >= len(s) or s[i] != "=":
            raise NwikiError(f"expected '=' after attr {key}", index=i)
        i += 1
        i = skip_ws(s, i)
        if i < len(s) and s[i] in "\"'":
            raw, i = parse_string(s, i)
            val = parse_interp_string_content(raw)
        else:
            val, i = parse_attr_value(s, i)
        attrs[key] = val
        i = skip_ws(s, i)

    if i < len(s) and s.startswith("/>", i):
        return Element(name=name, attrs=attrs, children=[], self_closing=True), i + 2

    if i < len(s) and s[i] == ">":
        i += 1
        # void-ish br
        if name.lower() == "br":
            return Element(name="br", attrs=attrs, children=[], self_closing=True), i
        children, i = parse_element_list(s, i)
        i = skip_ws(s, i)
        close = f"</{name}>"
        if not s.startswith(close, i):
            raise NwikiError(f"expected {close}", index=i)
        return Element(name=name, attrs=attrs, children=children), i + len(close)

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
