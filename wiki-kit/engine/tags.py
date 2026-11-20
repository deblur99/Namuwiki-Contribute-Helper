"""[@Component] 태그 토큰 파서.

나무위키의 {{ / {{{ / <#색> 와 겹치지 않도록 [@Name] ... [/@Name] 와
[@Name /] 형태만 사용한다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator

ATTR = re.compile(r'(\w+)=("([^"]*)"|\'([^\']*)\'|([^\s\]]+))')
TAG = re.compile(
    r"\[@(\w+)((?:\s+\w+=(?:\"[^\"]*\"|'[^']*'|[^\s\]]+))*)\s*(/)?\]"
    r"|\[/@(\w+)\]"
)


@dataclass
class TagToken:
    kind: str  # open | close | self
    name: str
    attrs: dict[str, str]
    start: int
    end: int
    raw: str


def parse_attrs(blob: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in ATTR.finditer(blob or ""):
        key = m.group(1)
        val = m.group(3) if m.group(3) is not None else (
            m.group(4) if m.group(4) is not None else m.group(5)
        )
        out[key] = val
    return out


def iter_tags(text: str) -> Iterator[TagToken]:
    for m in TAG.finditer(text):
        if m.group(4):  # close [/@Name]
            yield TagToken(
                kind="close",
                name=m.group(4),
                attrs={},
                start=m.start(),
                end=m.end(),
                raw=m.group(0),
            )
        elif m.group(3) == "/":
            yield TagToken(
                kind="self",
                name=m.group(1),
                attrs=parse_attrs(m.group(2) or ""),
                start=m.start(),
                end=m.end(),
                raw=m.group(0),
            )
        else:
            yield TagToken(
                kind="open",
                name=m.group(1),
                attrs=parse_attrs(m.group(2) or ""),
                start=m.start(),
                end=m.end(),
                raw=m.group(0),
            )


def find_matching_close(text: str, open_token: TagToken) -> TagToken | None:
    depth = 0
    for tok in iter_tags(text[open_token.end :]):
        abs_start = open_token.end + tok.start
        abs_end = open_token.end + tok.end
        adjusted = TagToken(
            kind=tok.kind,
            name=tok.name,
            attrs=tok.attrs,
            start=abs_start,
            end=abs_end,
            raw=tok.raw,
        )
        if adjusted.kind == "open" and adjusted.name == open_token.name:
            depth += 1
        elif adjusted.kind == "close" and adjusted.name == open_token.name:
            if depth == 0:
                return adjusted
            depth -= 1
    return None
