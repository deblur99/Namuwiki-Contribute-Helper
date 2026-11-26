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
    # attr name → absolute source index of value start (for diagnostics)
    attr_starts: dict[str, int] = field(default_factory=dict)


@dataclass
class CallStmt:
    name: str  # category | include | includeFrame | import | document | frame
    args: list[Any] = field(default_factory=list)  # str | EnumRef | CallExpr
    kwargs: dict[str, Any] = field(default_factory=dict)


@dataclass
class PropDecl:
    """Component prop from top-level `props { name: required, age }` (always String)."""

    name: str
    optional: bool = False


@dataclass
class Document:
    path: str | None = None
    stmts: list[CallStmt] = field(default_factory=list)
    template: list[Element] = field(default_factory=list)
    # binding name → flat string map from JSON import
    data_namespaces: dict[str, dict[str, str]] = field(default_factory=dict)
    # import Logo from "….png" → Logo → basename for [[파일:…]]
    asset_bindings: dict[str, str] = field(default_factory=dict)
    document_name: str | None = None
    prop_decls: dict[str, PropDecl] = field(default_factory=dict)
