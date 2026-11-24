"""nwiki AST node types."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Union


@dataclass
class EnumRef:
    name: str  # e.g. "right", "bold", "line-through"


@dataclass
class CallExpr:
    name: str
    args: list[Any] = field(default_factory=list)
    kwargs: dict[str, Any] = field(default_factory=dict)


@dataclass
class MemberAccess:
    """e.g. props.name"""

    parts: list[str]


@dataclass
class InterpPart:
    """Part of an interpolated string: literal or expression."""

    kind: str  # literal | expr
    value: Any


@dataclass
class InterpString:
    parts: list[InterpPart]


AttrValue = Union[str, bool, int, float, EnumRef, CallExpr, InterpString, list, None]


@dataclass
class Element:
    name: str
    attrs: dict[str, AttrValue] = field(default_factory=dict)
    children: list[Element] = field(default_factory=list)
    self_closing: bool = False


@dataclass
class CallStmt:
    name: str  # category | include | includeFrame | import
    args: list[Any] = field(default_factory=list)  # str | EnumRef | CallExpr
    kwargs: dict[str, Any] = field(default_factory=dict)


@dataclass
class Document:
    path: str | None = None
    stmts: list[CallStmt] = field(default_factory=list)
    script_props: dict[str, str] = field(default_factory=dict)
    template: list[Element] = field(default_factory=list)
    # stem → flat string map from import("….json")
    data_namespaces: dict[str, dict[str, str]] = field(default_factory=dict)
    # from document("표제어") — current wiki document title
    document_name: str | None = None
