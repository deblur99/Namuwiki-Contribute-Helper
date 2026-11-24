"""Render resolved nwiki AST to namuwiki raw markup."""

from __future__ import annotations

from .ast import (
    CallExpr,
    CallStmt,
    Document,
    Element,
    EnumRef,
    InterpString,
    MemberAccess,
)
from .docpath import resolve_to_document
from .errors import NwikiError
from .frames import build_include_macro

# Set for the duration of render_document (Link/Heading toDocument).
_render_document_name: str | None = None


def render_document(doc: Document) -> str:
    global _render_document_name
    parts: list[str] = []
    cats = [s for s in doc.stmts if s.name == "category"]
    incs = [s for s in doc.stmts if s.name in ("include", "includeFrame")]
    if cats:
        cat_bits: list[str] = []
        for s in cats:
            if not s.args or not isinstance(s.args[0], str):
                raise NwikiError("category() requires a string")
            cat_bits.append(f"[[분류:{s.args[0]}]]")
        parts.append("".join(cat_bits))
    for s in incs:
        parts.append(build_include_macro(s))
    prev = _render_document_name
    _render_document_name = doc.document_name
    try:
        emitted_toc = False
        for el in doc.template:
            if el.name == "Heading" and not emitted_toc:
                parts.append("[목차]\n[clearfix]")
                emitted_toc = True
                parts.append(render_heading(el, depth=2))
            else:
                parts.append(render_element(el, table_ctx=None))
        return "\n".join(p for p in parts if p is not None and p != "")
    finally:
        _render_document_name = prev


def render_element(el: Element, *, table_ctx: dict | None) -> str:
    name = el.name
    if name == "Table":
        return render_table(el)
    if name == "TableRow":
        raise NwikiError("TableRow outside Table")
    if name == "TableColumn":
        raise NwikiError("TableColumn outside TableRow")
    if name == "TitleText":
        return render_title_text(el)
    if name == "Text":
        return render_text(el)
    if name == "Image":
        return render_image(el)
    if name == "Link":
        return render_link(el)
    if name == "Comment":
        return render_comment(el)
    if name == "Space":
        return " "
    if name == "br":
        return "[br]"
    if name == "Box":
        return render_box(el)
    if name == "Row":
        return render_row_stack(el)
    if name == "Column":
        return render_column_stack(el)
    if name == "Folding":
        return render_folding(el)
    if name == "Heading":
        return render_heading(el, depth=2)
    if name == "Badge":
        return render_badge(el)
    if name == "Quote":
        return render_quote(el)
    raise NwikiError(f"unknown element {name}")


def render_box(el: Element) -> str:
    style = _box_style_string(el)
    body = _render_flow_children(el.children)
    if style:
        return '{{{#!wiki style="' + style + '"\n' + body + "\n}}}"
    return "{{{#!wiki\n" + body + "\n}}}"


def render_folding(el: Element) -> str:
    title = el.attrs.get("title")
    if not isinstance(title, str) or not title:
        raise NwikiError("Folding requires title string")
    body = _render_flow_children(el.children)
    return "{{{#!folding [ " + title + " ]\n" + body + "\n}}}"


def render_heading(el: Element, *, depth: int = 2) -> str:
    """Root Heading → == (depth 2); nested Heading children deepen by 1 (max 6)."""
    if el.attrs.get("level") is not None:
        raise NwikiError(
            "Heading no longer takes level=…; nest <Heading> for deeper sections"
        )
    title = el.attrs.get("title")
    if not isinstance(title, str) or not title:
        raise NwikiError("Heading requires title string")
    if not isinstance(depth, int) or depth < 1 or depth > 6:
        raise NwikiError(
            f"Heading nesting exceeds max depth 6 (got {depth}); flatten sections"
        )

    to_doc = el.attrs.get("toDocument")
    to_ext = el.attrs.get("toExternal")
    if to_doc is not None and to_ext is not None:
        raise NwikiError("Heading cannot take both toDocument and toExternal")
    if isinstance(to_doc, str):
        target = resolve_to_document(to_doc, _render_document_name)
        heading_text = f"[[{target}|{title}]]"
    elif isinstance(to_ext, str):
        heading_text = f"[[{to_ext}|{title}]]"
    elif to_doc is not None or to_ext is not None:
        raise NwikiError("Heading toDocument/toExternal must be string")
    else:
        heading_text = title

    collapsed = el.attrs.get("collapsed") is True
    marks = "=" * depth
    if collapsed:
        line = f"{marks}# {heading_text} #{marks}"
    else:
        line = f"{marks} {heading_text} {marks}"

    if not el.children:
        return line
    chunks: list[str] = [line]
    for ch in el.children:
        if ch.name == "Heading":
            chunks.append(render_heading(ch, depth=depth + 1))
        else:
            chunks.append(render_element(ch, table_ctx=None))
    return "\n".join(c for c in chunks if c is not None and c != "")


def render_quote(el: Element) -> str:
    """Namuwiki blockquote: each output line prefixed with '> '."""
    body = _render_flow_children(el.children)
    if not body:
        return "> "
    if "\n" in body:
        lines = body.split("\n")
        return "\n".join(f"> {line}" if line else ">" for line in lines)
    return f"> {body}"


def render_badge(el: Element) -> str:
    """Sugar: inline-block padded chip Box."""
    attrs = dict(el.attrs)
    if "display" not in attrs:
        attrs["display"] = EnumRef(name="inlineBlock")
    if "padding" not in attrs:
        attrs["padding"] = CallExpr(
            name="Spacing",
            args=[],
            kwargs={"vertical": 4, "horizontal": 5},
        )
    if "borderRadius" not in attrs:
        attrs["borderRadius"] = 5
    if "color" not in attrs:
        attrs["color"] = CallExpr(name="HexColor", args=["#fff"], kwargs={})
    synthetic = Element(name="Box", attrs=attrs, children=el.children)
    return render_box(synthetic)


_STACK_PASSTHROUGH = (
    "width",
    "maxWidth",
    "minWidth",
    "height",
    "margin",
    "padding",
    "border",
    "borderTop",
    "borderRight",
    "borderBottom",
    "borderLeft",
    "borderRadius",
    "bgColor",
    "background",
    "color",
    "opacity",
    "textAlign",
    "wordBreak",
    "fontSize",
    "fontFamily",
    "styleExtra",
)


def render_row_stack(el: Element) -> str:
    """Compose-style Row → flex / inline-flex Box (row)."""
    return render_box(_stack_as_box(el, direction="row"))


def render_column_stack(el: Element) -> str:
    """Compose-style Column → flex Box (column)."""
    return render_box(_stack_as_box(el, direction="column"))


def _stack_as_box(el: Element, *, direction: str) -> Element:
    """Flutter-tone axes: crossAxisAlignment / mainAxisAlignment / spacing."""
    attrs: dict = {}
    for key in _STACK_PASSTHROUGH:
        if key in el.attrs and el.attrs[key] is not None:
            attrs[key] = el.attrs[key]

    inline = el.attrs.get("inline") is True
    if direction == "row" and inline:
        attrs["display"] = EnumRef(name="inlineFlex")
    else:
        attrs["display"] = EnumRef(name="flex")
    attrs["flexDirection"] = EnumRef(name=direction)

    cross = el.attrs.get("crossAxisAlignment")
    if cross is not None:
        attrs["alignItems"] = _cross_axis_to_flex(cross)
    else:
        attrs["alignItems"] = EnumRef(name="center")

    main = el.attrs.get("mainAxisAlignment")
    if main is not None:
        attrs["justifyContent"] = _main_axis_to_flex(main)

    spacing = el.attrs.get("spacing")
    if spacing is not None:
        attrs["gap"] = spacing

    return Element(name="Box", attrs=attrs, children=el.children)


def _cross_axis_to_flex(val) -> EnumRef:
    name = _enum_name(val)
    mapping = {
        "center": "center",
        "start": "flexStart",
        "end": "flexEnd",
        "flexStart": "flexStart",
        "flexEnd": "flexEnd",
        "stretch": "stretch",
        "baseline": "baseline",
        "left": "flexStart",
        "right": "flexEnd",
        "top": "flexStart",
        "bottom": "flexEnd",
    }
    if name not in mapping:
        raise NwikiError(f"unknown crossAxisAlignment .{name}")
    return EnumRef(name=mapping[name])


def _main_axis_to_flex(val) -> EnumRef:
    name = _enum_name(val)
    mapping = {
        "center": "center",
        "start": "flexStart",
        "end": "flexEnd",
        "flexStart": "flexStart",
        "flexEnd": "flexEnd",
        "spaceBetween": "spaceBetween",
        "spaceAround": "spaceAround",
        "spaceEvenly": "spaceEvenly",
        "left": "flexStart",
        "right": "flexEnd",
        "top": "flexStart",
        "bottom": "flexEnd",
    }
    if name not in mapping:
        raise NwikiError(f"unknown mainAxisAlignment .{name}")
    return EnumRef(name=mapping[name])


def _render_flow_children(children: list[Element]) -> str:
    parts: list[str] = []
    for ch in children:
        parts.append(render_element(ch, table_ctx=None))
    return "".join(parts)


def _box_style_string(el: Element) -> str:
    decls: list[str] = []

    def add(prop: str, value: str | None) -> None:
        if value is not None and value != "":
            decls.append(f"{prop}: {value}")

    display = el.attrs.get("display")
    display_css = _display_css(display) if display is not None else None
    if display_css:
        add("display", display_css)

    for attr, css in (
        ("width", "width"),
        ("maxWidth", "max-width"),
        ("minWidth", "min-width"),
        ("height", "height"),
    ):
        if attr in el.attrs and el.attrs[attr] is not None:
            add(css, _layout_length_css(el.attrs[attr]))

    if el.attrs.get("margin") is not None:
        add("margin", _spacing_css(el.attrs["margin"]))
    if el.attrs.get("padding") is not None:
        add("padding", _spacing_css(el.attrs["padding"]))

    if el.attrs.get("border") is not None:
        add("border", _border_css(el.attrs["border"]))
    for attr, css in (
        ("borderTop", "border-top"),
        ("borderRight", "border-right"),
        ("borderBottom", "border-bottom"),
        ("borderLeft", "border-left"),
    ):
        if el.attrs.get(attr) is not None:
            add(css, _border_css(el.attrs[attr]))

    if el.attrs.get("borderRadius") is not None:
        add("border-radius", _radius_css(el.attrs["borderRadius"]))

    bg = el.attrs.get("bgColor")
    background = el.attrs.get("background")
    if background is not None and bg is not None:
        add("background-color", _paint_css(bg, lower=True))
        add("background", _background_css(background))
    elif background is not None:
        add("background", _background_css(background))
    elif bg is not None:
        add("background", _paint_css(bg, lower=True))

    if el.attrs.get("color") is not None:
        add("color", _paint_css(el.attrs["color"], lower=True))

    if el.attrs.get("opacity") is not None:
        add("opacity", _opacity_css(el.attrs["opacity"]))

    is_flex = display_css in ("flex", "inline-flex")
    for attr, css in (
        ("alignItems", "align-items"),
        ("justifyContent", "justify-content"),
        ("flexDirection", "flex-direction"),
    ):
        if el.attrs.get(attr) is not None:
            if not is_flex:
                raise NwikiError(f"{attr} requires display=.flex or .inlineFlex")
            add(css, _flex_css(_enum_name(el.attrs[attr])))

    if el.attrs.get("gap") is not None:
        add("gap", _gap_css(el.attrs["gap"]))

    if el.attrs.get("textAlign") is not None:
        add("text-align", _enum_name(el.attrs["textAlign"]))
    if el.attrs.get("wordBreak") is not None:
        add("word-break", _word_break_css(_enum_name(el.attrs["wordBreak"])))

    if isinstance(el.attrs.get("fontSize"), str):
        add("font-size", el.attrs["fontSize"])
    if isinstance(el.attrs.get("fontFamily"), str):
        add("font-family", el.attrs["fontFamily"])

    extra = el.attrs.get("styleExtra")
    if isinstance(extra, str) and extra.strip():
        piece = extra.strip().rstrip(";")
        decls.append(piece)

    return "; ".join(decls)


def _display_css(val) -> str:
    name = _enum_name(val)
    mapping = {
        "block": "block",
        "inline": "inline",
        "inlineBlock": "inline-block",
        "inlineFlex": "inline-flex",
        "flex": "flex",
    }
    if name not in mapping:
        raise NwikiError(f"unknown BoxDisplay .{name}")
    return mapping[name]


def _gap_css(val) -> str:
    if isinstance(val, (int, float)):
        n = int(val) if isinstance(val, float) and val.is_integer() else val
        return f"{n}px"
    if isinstance(val, CallExpr) and val.name == "LayoutLength":
        return _layout_length_css(val)
    raise NwikiError("spacing/gap expected number (px) or LayoutLength")


def _flex_css(name: str) -> str:
    mapping = {
        "center": "center",
        "flexStart": "flex-start",
        "flexEnd": "flex-end",
        "stretch": "stretch",
        "baseline": "baseline",
        "spaceBetween": "space-between",
        "spaceAround": "space-around",
        "spaceEvenly": "space-evenly",
        "row": "row",
        "column": "column",
    }
    if name not in mapping:
        raise NwikiError(f"unknown flex value .{name}")
    return mapping[name]


def _word_break_css(name: str) -> str:
    mapping = {
        "keepAll": "keep-all",
        "breakAll": "break-all",
        "normal": "normal",
    }
    if name not in mapping:
        raise NwikiError(f"unknown WordBreak .{name}")
    return mapping[name]


def _layout_length_css(val) -> str:
    if isinstance(val, EnumRef) and val.name == "auto":
        return "auto"
    if isinstance(val, str) and val.lower() == "auto":
        return "auto"
    if isinstance(val, CallExpr) and val.name == "LayoutLength":
        if not val.args:
            raise NwikiError("LayoutLength requires length")
        n = val.args[0]
        if isinstance(n, EnumRef) and n.name == "auto":
            return "auto"
        if isinstance(n, str) and n.lower() == "auto":
            return "auto"
        n_s = _num_str(n)
        unit = EnumRef(name="point")
        if len(val.args) > 1:
            unit = val.args[1]
        elif "type" in val.kwargs:
            unit = val.kwargs["type"]
        uname = unit.name if isinstance(unit, EnumRef) else _enum_name(unit)
        if uname == "percent":
            return f"{n_s}%"
        if uname == "auto":
            return "auto"
        return f"{n_s}px"
    if isinstance(val, (int, float)):
        return f"{_num_str(val)}px"
    raise NwikiError("expected LayoutLength")


def _spacing_css(val) -> str:
    if not isinstance(val, CallExpr) or val.name != "Spacing":
        # bare number / auto
        return _spacing_side(val)
    args, kw = val.args, val.kwargs
    if args and not kw:
        return _spacing_side(args[0])
    if any(k in kw for k in ("top", "right", "bottom", "left")):
        if "horizontal" in kw and "right" not in kw and "left" not in kw:
            h = _spacing_side(kw["horizontal"])
            t = _spacing_side(kw.get("top", 0))
            if "bottom" in kw:
                b = _spacing_side(kw["bottom"])
                return f"{t} {h} {b}"
            return f"{t} {h}"
        t = _spacing_side(kw.get("top", 0))
        r = _spacing_side(kw.get("right", 0))
        b = _spacing_side(kw.get("bottom", 0))
        l = _spacing_side(kw.get("left", 0))
        return f"{t} {r} {b} {l}"
    if "vertical" in kw or "horizontal" in kw:
        v = _spacing_side(kw.get("vertical", 0))
        h = _spacing_side(kw.get("horizontal", 0))
        return f"{v} {h}"
    raise NwikiError("Spacing requires sides or vertical/horizontal")


def _spacing_side(val) -> str:
    if isinstance(val, EnumRef) and val.name == "auto":
        return "auto"
    if isinstance(val, str) and val.lower() == "auto":
        return "auto"
    if isinstance(val, (int, float)):
        return f"{_num_str(val)}px"
    raise NwikiError("Spacing side expected number or .auto")


def _border_css(val) -> str:
    if not isinstance(val, CallExpr) or val.name != "Border":
        raise NwikiError("expected Border(...)")
    width = val.kwargs.get("width", val.args[0] if val.args else 1)
    if isinstance(width, (int, float)) and float(width) == 0:
        return "none"
    w = f"{_num_str(width)}px"
    style_val = val.kwargs.get("style")
    if style_val is None and len(val.args) > 1:
        style_val = val.args[1]
    style = _enum_name(style_val) if style_val is not None else "solid"
    if style == "none":
        return "none"
    color_val = val.kwargs.get("color")
    if color_val is None and len(val.args) > 2:
        color_val = val.args[2]
    if color_val is not None:
        return f"{w} {style} {_hex(color_val, lower=True)}"
    return f"{w} {style}"


def _radius_css(val) -> str:
    if isinstance(val, (int, float)):
        return f"{_num_str(val)}px"
    return _layout_length_css(val)


def _num_str(n) -> str:
    if isinstance(n, float) and n.is_integer():
        return str(int(n))
    if isinstance(n, int):
        return str(n)
    if isinstance(n, float):
        return str(n)
    raise NwikiError(f"expected number, got {type(n).__name__}")


def render_table(table: Element) -> str:
    ctx = {
        "align": table.attrs.get("align"),
        "width": table.attrs.get("width"),
        "borderColor": table.attrs.get("borderColor"),
        "bgColor": table.attrs.get("bgColor"),
        "hoisted": False,
    }
    rows_out: list[str] = []
    for row in table.children:
        if row.name != "TableRow":
            raise NwikiError(f"Table child must be TableRow, got {row.name}")
        rows_out.append(render_row(row, ctx))
    return "\n".join(rows_out)


def render_row(row: Element, ctx: dict) -> str:
    # namuwiki: || cell1 || cell2 ||
    cells: list[str] = []
    for col in row.children:
        if col.name != "TableColumn":
            raise NwikiError("TableRow children must be TableColumn")
        cells.append(render_column_inner(col, ctx))
    return "||" + "||".join(cells) + "||"


def render_column_inner(col: Element, ctx: dict) -> str:
    """Return one cell's interior (no surrounding ||)."""
    prefixes: list[str] = []
    col_span = col.attrs.get("colSpan")
    if isinstance(col_span, int) and col_span > 1:
        prefixes.append(f"<-{col_span}>")
    elif isinstance(col_span, float) and int(col_span) > 1:
        prefixes.append(f"<-{int(col_span)}>")

    width = col.attrs.get("width")
    if width is not None:
        prefixes.append(f"<width={_layout_length(width)}>")

    nopad = col.attrs.get("nopad")
    if nopad is True:
        prefixes.append("<nopad>")

    alignment = col.attrs.get("alignment")
    if alignment is not None:
        prefixes.append(_cell_align_prefix(alignment))

    if not ctx["hoisted"]:
        ctx["hoisted"] = True
        if ctx.get("align") is not None:
            prefixes.append(f"<tablealign={_enum_name(ctx['align'])}>")
        if ctx.get("width") is not None:
            prefixes.append(f"<tablewidth={_layout_length(ctx['width'])}>")
        if ctx.get("borderColor") is not None:
            prefixes.append(f"<tablebordercolor={_hex(ctx['borderColor'])}>")
        if ctx.get("bgColor") is not None:
            prefixes.append(f"<tablebgcolor={_hex(ctx['bgColor'])}>")

    bg = col.attrs.get("bgColor")
    has_title = any(c.name == "TitleText" for c in col.children)
    if bg is not None:
        if has_title:
            prefixes.append(f"<colbgcolor={_hex(bg)}>")
            prefixes.append("<colcolor=#fff>")
        else:
            # namuwiki cell bgcolor shorthand: <#RRGGBB>
            prefixes.append(f"<{_hex(bg)}>")

    body = render_inline_children(col.children, delimiter=col.attrs.get("delimiter"))
    prefix = "".join(prefixes)
    if not body:
        return f"{prefix} "
    if prefix:
        return f"{prefix} {body} "
    if body.startswith("'''"):
        return f" {body} "
    return f"{body} "


def render_inline_children(
    children: list[Element], *, delimiter: object | None
) -> str:
    delim = delimiter if isinstance(delimiter, str) else None
    pieces: list[str] = []
    i = 0
    while i < len(children):
        ch = children[i]
        if ch.name == "Comment":
            # sticky to previous — should not happen as first without prior
            pieces.append(render_comment(ch))
            i += 1
            continue

        chunk = render_element(ch, table_ctx=None)
        # attach following comments without delimiter
        j = i + 1
        while j < len(children) and children[j].name == "Comment":
            chunk += render_comment(children[j])
            j += 1

        if pieces and delim is not None:
            # delimiter between chunks (not before first)
            pieces.append(delim)
        pieces.append(chunk)
        i = j
    return "".join(pieces)


def render_title_text(el: Element) -> str:
    text = _eval_text_attr(el.attrs.get("text", ""))
    return "{{{+1 '''" + text + "'''}}}"


def render_text(el: Element) -> str:
    text = _eval_text_attr(el.attrs.get("text", ""))
    weight = el.attrs.get("weight")
    size = el.attrs.get("size")
    deco = el.attrs.get("decoration")

    if weight is not None and _enum_name(weight) == "bold":
        text = f"'''{text}'''"

    if deco is not None:
        names = []
        if isinstance(deco, list):
            names = [_enum_name(x) for x in deco]
        else:
            names = [_enum_name(deco)]
        if "line-through" in names:
            text = f"--{text}--"

    if size is not None:
        step = _size_step(size)
        if step != 0:
            sign = f"+{step}" if step > 0 else str(step)
            text = f"{{{{{{{sign} {text}}}}}}}"

    return text


def render_image(el: Element) -> str:
    file_name = el.attrs.get("fileName")
    if not isinstance(file_name, str):
        raise NwikiError("Image requires fileName string")
    opts: list[str] = []
    w = el.attrs.get("width")
    h = el.attrs.get("height")
    if w is not None:
        opts.append(f"width={_layout_length(w)}")
    if h is not None:
        opts.append(f"height={_layout_length(h)}")
    inner = f"파일:{file_name}"
    if opts:
        return f"[[{inner}|{'&'.join(opts)}]]"
    return f"[[{inner}]]"


def render_link(el: Element) -> str:
    to_doc = el.attrs.get("toDocument")
    to_ext = el.attrs.get("toExternal")
    if to_doc is not None and to_ext is not None:
        raise NwikiError("Link cannot take both toDocument and toExternal")
    if isinstance(to_doc, str):
        target = resolve_to_document(to_doc, _render_document_name)
    elif isinstance(to_ext, str):
        target = to_ext
    else:
        raise NwikiError("Link requires toDocument or toExternal")

    label_attr = el.attrs.get("label")
    if el.children:
        label = render_inline_children(el.children, delimiter=None)
        return f"[[{target}|{label}]]"
    if isinstance(label_attr, str):
        return f"[[{target}|{label_attr}]]"
    return f"[[{target}]]"


def render_comment(el: Element) -> str:
    if "text" in el.attrs and el.attrs["text"] is not None:
        body = _eval_text_attr(el.attrs["text"])
    else:
        body = render_inline_children(el.children, delimiter=None)
    return f"[* {body}]"


def _eval_text_attr(val) -> str:
    if isinstance(val, str):
        return val
    if isinstance(val, InterpString):
        out: list[str] = []
        for p in val.parts:
            if p.kind == "literal":
                out.append(str(p.value))
            else:
                out.append(_eval_expr(p.value))
        return "".join(out)
    if val is None:
        return ""
    return _eval_expr(val)


def _eval_expr(expr) -> str:
    if isinstance(expr, str):
        return expr
    if isinstance(expr, CallExpr):
        if expr.name == "age":
            return f"[age({_date_arg(expr)})]"
        if expr.name == "dday":
            return f"[dday({_date_arg(expr)})]"
        raise NwikiError(f"unsupported call in text: {expr.name}")
    if isinstance(expr, MemberAccess):
        raise NwikiError(f"unresolved member {'.'.join(expr.parts)}")
    raise NwikiError(f"cannot evaluate {type(expr).__name__}")


def _date_arg(call: CallExpr) -> str:
    if not call.args:
        raise NwikiError("age/dday require Date(...)")
    d = call.args[0]
    if not isinstance(d, CallExpr) or d.name != "Date":
        raise NwikiError("age/dday expect Date(...)")
    y = int(d.kwargs["year"])
    m = int(d.kwargs["month"])
    day = int(d.kwargs["day"])
    return f"{y:04d}-{m:02d}-{day:02d}"


def _cell_align_prefix(val) -> str:
    """Namuwiki cell alignment: <:> / <(> / <)>."""
    name = _enum_name(val)
    mapping = {
        "center": "<:>",
        "left": "<(>",
        "right": "<)>",
    }
    if name not in mapping:
        raise NwikiError(f"unknown TableColumn alignment .{name}")
    return mapping[name]


def _enum_name(val) -> str:
    if isinstance(val, EnumRef):
        return val.name
    if isinstance(val, str):
        return val.lstrip(".")
    raise NwikiError(f"expected enum, got {type(val).__name__}")


def _size_step(val) -> int:
    if isinstance(val, CallExpr) and val.name == "step":
        if not val.args:
            raise NwikiError("step() requires argument")
        return int(val.args[0])
    raise NwikiError("size expected .step(n)")


def _layout_length(val) -> str:
    if isinstance(val, CallExpr) and val.name == "LayoutLength":
        if not val.args:
            raise NwikiError("LayoutLength requires length")
        n = val.args[0]
        # int-looking floats
        if isinstance(n, float) and n.is_integer():
            n_s = str(int(n))
        else:
            n_s = str(int(n)) if isinstance(n, int) else str(n)
        unit = EnumRef(name="point")
        if len(val.args) > 1:
            unit = val.args[1]
        elif "type" in val.kwargs:
            unit = val.kwargs["type"]
        uname = _enum_name(unit) if not isinstance(unit, EnumRef) else unit.name
        # also EnumRef
        if isinstance(unit, EnumRef):
            uname = unit.name
        if uname == "percent":
            return f"{n_s}%"
        return n_s
    if isinstance(val, (int, float)):
        return str(int(val))
    raise NwikiError("expected LayoutLength")


def _hex(val, *, lower: bool = False) -> str:
    if isinstance(val, CallExpr) and val.name == "HexColor":
        if val.kwargs:
            light = str(val.kwargs.get("light", ""))
            dark = str(val.kwargs.get("dark", ""))
            # dual theme: golden uses lowercase
            return f"{_norm_hex(light, lower=True)},{_norm_hex(dark, lower=True)}"
        if val.args:
            return _norm_hex(str(val.args[0]), lower=lower)
    if isinstance(val, str):
        return _norm_hex(val, lower=lower)
    raise NwikiError("expected HexColor")


def _paint_css(val, *, lower: bool = False) -> str:
    """Solid paint: HexColor | RgbaColor | .transparent."""
    if isinstance(val, EnumRef) and val.name == "transparent":
        return "transparent"
    if isinstance(val, str) and val.lower() == "transparent":
        return "transparent"
    if isinstance(val, CallExpr) and val.name == "RgbaColor":
        return _rgba_css(val)
    return _hex(val, lower=lower)


def _rgba_css(val: CallExpr) -> str:
    if len(val.args) < 3:
        raise NwikiError("RgbaColor requires r, g, b[, a]")
    r, g, b = (int(val.args[0]), int(val.args[1]), int(val.args[2]))
    a = float(val.args[3]) if len(val.args) > 3 else float(val.kwargs.get("a", 1))
    for c, name in ((r, "r"), (g, "g"), (b, "b")):
        if c < 0 or c > 255:
            raise NwikiError(f"RgbaColor {name} must be 0...255")
    if a < 0 or a > 1:
        raise NwikiError("RgbaColor alpha must be 0...1")
    a_s = str(int(a)) if isinstance(a, float) and a.is_integer() else str(a)
    return f"rgba({r}, {g}, {b}, {a_s})"


def _opacity_css(val) -> str:
    if not isinstance(val, (int, float)):
        raise NwikiError("opacity expected number 0...1")
    n = float(val)
    if n < 0 or n > 1:
        raise NwikiError("opacity must be 0...1")
    if isinstance(val, float) and val.is_integer() or isinstance(val, int):
        return str(int(n))
    return str(n)


def _background_css(val) -> str:
    if isinstance(val, list):
        if not val:
            raise NwikiError("background list is empty")
        return ", ".join(_background_layer_css(x) for x in val)
    return _background_layer_css(val)


def _background_layer_css(val) -> str:
    if isinstance(val, CallExpr):
        if val.name in ("LinearGradient", "RepeatingLinearGradient"):
            return _linear_gradient_css(val)
        if val.name == "RadialGradient":
            return _radial_gradient_css(val)
        if val.name in ("HexColor", "RgbaColor"):
            return _paint_css(val, lower=True)
    if isinstance(val, EnumRef) and val.name == "transparent":
        return "transparent"
    if isinstance(val, str):
        return _paint_css(val, lower=True)
    raise NwikiError("background expected Gradient, HexColor, or list")


def _linear_gradient_css(val: CallExpr) -> str:
    prefix = (
        "repeating-linear-gradient"
        if val.name == "RepeatingLinearGradient"
        else "linear-gradient"
    )
    direction, stops = _split_gradient_args(val)
    if not stops:
        raise NwikiError(f"{val.name} requires color stops")
    head = _gradient_direction_css(direction) if direction is not None else None
    stop_s = ", ".join(_color_stop_css(s) for s in stops)
    if head:
        return f"{prefix}({head}, {stop_s})"
    return f"{prefix}({stop_s})"


def _radial_gradient_css(val: CallExpr) -> str:
    shape = ".circle"
    if val.args and isinstance(val.args[0], EnumRef):
        shape = val.args[0].name
    elif "shape" in val.kwargs:
        shape = _enum_name(val.kwargs["shape"])
    shape_css = "circle" if shape in ("circle", ".circle") else shape.lstrip(".")

    at_x = val.kwargs.get("atX")
    at_y = val.kwargs.get("atY")
    at_part = ""
    if at_x is not None or at_y is not None:
        x = _gradient_percent(at_x if at_x is not None else 50)
        y = _gradient_percent(at_y if at_y is not None else 50)
        at_part = f" at {x} {y}"

    stops = [
        a
        for a in val.args
        if not (isinstance(a, EnumRef) and a.name in ("circle", "ellipse"))
    ]
    if "stops" in val.kwargs and isinstance(val.kwargs["stops"], list):
        stops = val.kwargs["stops"]
    if not stops:
        raise NwikiError("RadialGradient requires color stops")
    stop_s = ", ".join(_color_stop_css(s) for s in stops)
    return f"radial-gradient({shape_css}{at_part}, {stop_s})"


def _split_gradient_args(val: CallExpr) -> tuple[object | None, list]:
    direction = val.kwargs.get("direction")
    if direction is None:
        direction = val.kwargs.get("to")
    angle = val.kwargs.get("angle")
    if direction is None and angle is not None:
        direction = ("angle", angle)

    args = list(val.args)
    if direction is None and args:
        first = args[0]
        if isinstance(first, EnumRef) and first.name.startswith("to"):
            direction = first
            args = args[1:]
        elif isinstance(first, (int, float)):
            direction = ("angle", first)
            args = args[1:]

    if "stops" in val.kwargs and isinstance(val.kwargs["stops"], list):
        return direction, val.kwargs["stops"]
    return direction, args


def _gradient_direction_css(direction) -> str:
    if isinstance(direction, tuple) and direction and direction[0] == "angle":
        return f"{_num_str(direction[1])}deg"
    if isinstance(direction, (int, float)):
        return f"{_num_str(direction)}deg"
    name = _enum_name(direction)
    mapping = {
        "toRight": "to right",
        "toLeft": "to left",
        "toTop": "to top",
        "toBottom": "to bottom",
        "toTopRight": "to top right",
        "toTopLeft": "to top left",
        "toBottomRight": "to bottom right",
        "toBottomLeft": "to bottom left",
        "right": "to right",
        "left": "to left",
        "top": "to top",
        "bottom": "to bottom",
    }
    if name not in mapping:
        raise NwikiError(f"unknown GradientDirection .{name}")
    return mapping[name]


def _color_stop_css(val) -> str:
    if isinstance(val, CallExpr) and val.name == "ColorStop":
        if not val.args:
            raise NwikiError("ColorStop requires color")
        color = _paint_css(val.args[0], lower=True)
        at = val.kwargs.get("at", val.args[1] if len(val.args) > 1 else None)
        until = val.kwargs.get("until", val.args[2] if len(val.args) > 2 else None)
        parts = [color]
        if at is not None:
            parts.append(_gradient_percent(at))
        if until is not None:
            parts.append(_gradient_percent(until))
        return " ".join(parts)
    return _paint_css(val, lower=True)


def _gradient_percent(val) -> str:
    if isinstance(val, CallExpr) and val.name == "LayoutLength":
        return _layout_length_css(val)
    if isinstance(val, (int, float)):
        return f"{_num_str(val)}%"
    raise NwikiError("gradient position expected number (%) or LayoutLength")


def _norm_hex(h: str, *, lower: bool = False) -> str:
    """Parse #RGB or #RRGGBB; preserve digit length on emit."""
    raw = h.strip()
    if not raw.startswith("#"):
        raw = "#" + raw
    body = raw[1:]
    if len(body) in (4, 8):
        raise NwikiError(
            f"invalid HexColor {h!r}: namuwiki does not support "
            "#RGBA/#RRGGBBAA; use RgbaColor / opacity / .transparent"
        )
    if len(body) not in (3, 6):
        raise NwikiError(
            f"invalid HexColor {h!r}: expected #RGB (3) or #RRGGBB (6)"
        )
    if any(c not in "0123456789abcdefABCDEF" for c in body):
        raise NwikiError(f"invalid HexColor {h!r}: non-hex digit")
    out = "#" + body
    return out.lower() if lower else out
