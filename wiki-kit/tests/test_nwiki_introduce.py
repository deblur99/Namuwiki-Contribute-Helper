"""Golden test for examples/introduce.nwiki → namuwiki raw."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import sys

sys.path.insert(0, str(ROOT))

from engine.nwiki.pipeline import build_nwiki  # noqa: E402
from engine.nwiki.validate import validate_document  # noqa: E402
from engine.nwiki.parser import parse_file  # noqa: E402
from engine.nwiki.resolve import resolve_imports  # noqa: E402
from engine.nwiki.errors import NwikiError  # noqa: E402
from engine.nwiki.ast import Element  # noqa: E402


class IntroduceGoldenTest(unittest.TestCase):
    def test_matches_golden(self) -> None:
        got = build_nwiki(ROOT / "examples" / "introduce.nwiki").rstrip("\n")
        exp = (ROOT / "fixtures" / "introduce.golden.md").read_text(encoding="utf-8").rstrip(
            "\n"
        )
        self.assertEqual(got, exp)

    def test_row_requires_column(self) -> None:
        doc = parse_file(str(ROOT / "examples" / "ProfileTable.nwiki"))
        # inject illegal child
        table = doc.template[0]
        row = table.children[0]
        row.children = [Element(name="Text", attrs={"text": "x"}, children=[])]
        with self.assertRaises(NwikiError):
            validate_document(doc)

    def test_resolve_import(self) -> None:
        doc = parse_file(str(ROOT / "examples" / "introduce.nwiki"))
        resolved = resolve_imports(doc)
        self.assertTrue(any(e.name == "Table" for e in resolved.template))
        self.assertFalse(any(e.name == "ProfileTable" for e in resolved.template))

    def test_profile_table_standalone_script_props(self) -> None:
        markup = build_nwiki(ROOT / "examples" / "ProfileTable.nwiki")
        self.assertIn("{{{+1 '''김마리'''}}}", markup)
        self.assertNotIn("props.name", markup)

    def test_include_frame_sugar(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document

        doc = parse_document(
            'includeFrame("접근 제한")\nincludeFrame("틀:이미있음")\ninclude("기타")\n'
        )
        out = render_document(doc)
        self.assertIn("[include(틀:접근 제한)]", out)
        self.assertIn("[include(틀:이미있음)]", out)
        self.assertIn("[include(기타)]", out)
        self.assertNotIn("[include(틀:틀:이미있음)]", out)

    def test_common_frames_golden(self) -> None:
        got = build_nwiki(ROOT / "examples" / "common_frames.nwiki").rstrip("\n")
        exp = (ROOT / "fixtures" / "common_frames.golden.md").read_text(
            encoding="utf-8"
        ).rstrip("\n")
        self.assertEqual(got, exp)

    def test_doc_comment_strip(self) -> None:
        from engine.nwiki.parser import parse_document, strip_comments
        from engine.nwiki.render import render_document

        src = (
            '/// Component docs\n'
            '/// more **md**\n'
            'includeFrame(.adult)\n'
            "<template>\n"
            "  /// before heading\n"
            '  <Heading title="x" />\n'
            "</template>\n"
        )
        cleaned = strip_comments(src)
        self.assertNotIn("///", cleaned)
        out = render_document(parse_document(src))
        self.assertIn("[include(틀:선정성)]", out)
        self.assertIn("[목차]", out)
        self.assertIn("== x ==", out)

    def test_common_frame_associated_and_flat(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document

        a = render_document(
            parse_document('includeFrame(.discussion("표제어"))\n')
        )
        b = render_document(
            parse_document('includeFrame(.discussion, "표제어")\n')
        )
        self.assertEqual(a, b)
        self.assertIn("[include(틀:토론 중, 토론사유=표제어)]", a)

    def test_box_header_golden(self) -> None:
        got = build_nwiki(ROOT / "examples" / "box_header.nwiki").rstrip("\n")
        exp = (ROOT / "fixtures" / "box_header.golden.md").read_text(
            encoding="utf-8"
        ).rstrip("\n")
        self.assertEqual(got, exp)

    def test_hex_color_rgb3_and_rgb6(self) -> None:
        from engine.nwiki.render import _norm_hex

        self.assertEqual(_norm_hex("#fff"), "#fff")
        self.assertEqual(_norm_hex("#FFF", lower=True), "#fff")
        self.assertEqual(_norm_hex("87CEEB"), "#87CEEB")
        self.assertEqual(_norm_hex("#87CEEB", lower=True), "#87ceeb")
        with self.assertRaises(NwikiError):
            _norm_hex("#12")
        with self.assertRaises(NwikiError) as ctx4:
            _norm_hex("#1234")
        self.assertIn("RRGGBBAA", str(ctx4.exception))
        with self.assertRaises(NwikiError) as ctx8:
            _norm_hex("#12345678")
        self.assertIn("RRGGBBAA", str(ctx8.exception))
        with self.assertRaises(NwikiError):
            _norm_hex("#ggg")

    def test_heading_paragraph(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document
        from engine.nwiki.validate import validate_document

        doc = parse_document(
            """
<template>
  <Heading title="개요">
    <Text text="소개" />
    <Heading title="스포일러" collapsed=true>
      <Text text="숨긴 본문" />
    </Heading>
  </Heading>
  <Heading title="여담" />
</template>
"""
        )
        validate_document(doc)
        out = render_document(doc)
        self.assertTrue(out.startswith("[목차]\n[clearfix]\n== 개요 =="))
        self.assertIn("소개", out)
        self.assertIn("===# 스포일러 #===", out)
        self.assertIn("숨긴 본문", out)
        self.assertIn("== 여담 ==", out)

        bad_level = parse_document(
            '<template><Heading level=2 title="x" /></template>'
        )
        with self.assertRaises(NwikiError) as ctx:
            validate_document(bad_level)
        self.assertIn("level", str(ctx.exception))

        # depth 2 + 5 nests → depth 7 exceeds max
        deep = "<template><Heading title='a'>" + "".join(
            f"<Heading title='d{i}'>" for i in range(5)
        ) + "<Text text='x' />" + ("</Heading>" * 5) + "</Heading></template>"
        bad_deep = parse_document(deep)
        with self.assertRaises(NwikiError):
            validate_document(bad_deep)

    def test_heading_link_and_toc(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document
        from engine.nwiki.validate import validate_document

        doc = parse_document(
            """
<template>
  <Quote><Text text="앞" /></Quote>
  <Heading title="음반" toDocument="/음반 목록" />
  <Heading title="외부" toExternal="https://example.com" />
</template>
"""
        )
        validate_document(doc)
        out = render_document(doc)
        self.assertIn("> 앞\n[목차]\n[clearfix]\n== [[/음반 목록|음반]] ==", out)
        self.assertIn("== [[https://example.com|외부]] ==", out)

        both = parse_document(
            '<template><Heading title="x" toDocument="a" toExternal="b" /></template>'
        )
        with self.assertRaises(NwikiError):
            validate_document(both)

        no_heading = parse_document(
            '<template><Quote><Text text="만" /></Quote></template>'
        )
        out2 = render_document(no_heading)
        self.assertNotIn("[목차]", out2)

    def test_document_relative_todocument(self) -> None:
        from engine.nwiki.docpath import resolve_to_document
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document
        from engine.nwiki.validate import validate_document

        self.assertEqual(
            resolve_to_document("./음반 목록", "김마리(가수)"),
            "김마리(가수)/음반 목록",
        )
        self.assertEqual(
            resolve_to_document("../공연 목록", "김마리(가수)/음반 목록"),
            "김마리(가수)/공연 목록",
        )
        self.assertEqual(
            resolve_to_document(r"\./음반 목록", "김마리(가수)"),
            "./음반 목록",
        )
        self.assertEqual(
            resolve_to_document(r"\../공연 목록", None),
            "../공연 목록",
        )
        self.assertEqual(
            resolve_to_document("\\\\./음반 목록", None),
            "\\./음반 목록",
        )
        self.assertEqual(resolve_to_document("음반 목록", None), "음반 목록")

        # nwiki string unescape: "\\./x" → value \./x → literal ./x
        esc = parse_document(
            'document("A")\n'
            '<template><Link toDocument="\\\\./x" /></template>\n'
        )
        validate_document(esc)
        self.assertEqual(esc.template[0].attrs["toDocument"], "\\./x")
        self.assertIn("[[./x]]", render_document(esc))

        doc = parse_document(
            """
document("김마리(가수)")
<template>
  <Heading title="음반" toDocument="./음반 목록" />
  <Link toDocument="./응원법" />
  <Link toDocument="./응원법" label="응원" />
</template>
"""
        )
        self.assertEqual(doc.document_name, "김마리(가수)")
        validate_document(doc)
        out = render_document(doc)
        self.assertIn("== [[김마리(가수)/음반 목록|음반]] ==", out)
        self.assertIn("[[김마리(가수)/응원법]]", out)
        self.assertIn("[[김마리(가수)/응원법|응원]]", out)

        sub = parse_document(
            """
document("김마리(가수)/음반 목록")
<template>
  <Link toDocument="../공연 목록" />
</template>
"""
        )
        validate_document(sub)
        self.assertIn(
            "[[김마리(가수)/공연 목록]]", render_document(sub)
        )

        with self.assertRaises(NwikiError):
            parse_document('document("a")\ndocument("b")\n')

        missing = parse_document(
            '<template><Link toDocument="./x" /></template>'
        )
        with self.assertRaises(NwikiError):
            validate_document(missing)

        no_parent = parse_document(
            'document("김마리(가수)")\n'
            '<template><Link toDocument="../x" /></template>\n'
        )
        with self.assertRaises(NwikiError):
            validate_document(no_parent)

    def test_quote_block(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document
        from engine.nwiki.validate import validate_document

        doc = parse_document(
            """
<template>
  <Quote>
    <Text text="인용구" weight=.bold />
  </Quote>
  <Quote>
    <Text text="첫 줄" />
    <br />
    <Text text="둘째" />
  </Quote>
  <Quote>
    <Link toDocument="가수" label="문서" />
    <Space />
    <Text text="본문" />
  </Quote>
</template>
"""
        )
        validate_document(doc)
        out = render_document(doc)
        self.assertIn("> '''인용구'''", out)
        self.assertIn("> 첫 줄[br]둘째", out)
        self.assertIn("> [[가수|문서]] 본문", out)

    def test_opacity_and_gradients(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document

        doc = parse_document(
            """
<template>
  <Box
    opacity=0.5
    background=LinearGradient(.toRight, HexColor("#FFB9B9"), HexColor("#FFFDBB"))>
    <Text text="x" />
  </Box>
  <Box
    background=LinearGradient(
      direction: .toRight,
      ColorStop(HexColor("#AFEEEE"), at: 65),
      ColorStop(HexColor("#4682B4"), at: 80)
    )>
    <Text text="y" />
  </Box>
  <Box
    bgColor=HexColor("#fff")
    background=RadialGradient(.circle, atX: 50, atY: 0, HexColor("#000"), ColorStop(.transparent, at: 30))
    opacity=1>
    <Text text="z" />
  </Box>
  <Box background=RgbaColor(255, 255, 255, 0.875)>
    <Text text="a" />
  </Box>
</template>
"""
        )
        out = render_document(doc)
        self.assertIn("opacity: 0.5", out)
        self.assertIn(
            "background: linear-gradient(to right, #ffb9b9, #fffdbb)", out
        )
        self.assertIn(
            "linear-gradient(to right, #afeeee 65%, #4682b4 80%)", out
        )
        self.assertIn("background-color: #fff", out)
        self.assertIn(
            "radial-gradient(circle at 50% 0%, #000, transparent 30%)", out
        )
        self.assertIn("background: rgba(255, 255, 255, 0.875)", out)

    def test_json_import_golden(self) -> None:
        got = build_nwiki(ROOT / "examples" / "with_data.nwiki").rstrip("\n")
        exp = (ROOT / "fixtures" / "with_data.golden.md").read_text(
            encoding="utf-8"
        ).rstrip("\n")
        self.assertEqual(got, exp)

    def test_json_import_missing_file(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.resolve import resolve_document

        doc = parse_document(
            'import("./missing.json")\n<template><Text text="x" /></template>\n',
            path=str(ROOT / "examples" / "with_data.nwiki"),
        )
        with self.assertRaises(NwikiError):
            resolve_document(doc)

    def test_json_import_unknown_key(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.resolve import resolve_document

        doc = parse_document(
            'import("./data/designSystem.json")\n'
            '<template><Text text="${designSystem.nope}" /></template>\n',
            path=str(ROOT / "examples" / "with_data.nwiki"),
        )
        with self.assertRaises(NwikiError) as ctx:
            resolve_document(doc)
        self.assertIn("unknown data key", str(ctx.exception))

    def test_json_import_inside_script(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.resolve import resolve_document

        doc = parse_document(
            '<script>\n'
            '  import("./data/designSystem.json")\n'
            "</script>\n"
            "<template>\n"
            '  <Text text="${designSystem.accentColor}" />\n'
            "</template>\n",
            path=str(ROOT / "examples" / "with_data.nwiki"),
        )
        resolved = resolve_document(doc)
        self.assertEqual(
            resolved.data_namespaces["designSystem"]["accentColor"], "#87CEEB"
        )
        from engine.nwiki.render import render_document

        out = render_document(resolved)
        self.assertIn("#87CEEB", out)

    def test_kimmarie_frame_json_in_script(self) -> None:
        frame = (
            ROOT.parent / "김마리" / "components" / "Frame.nwiki"
        ).resolve()
        if not frame.is_file():
            self.skipTest("김마리/components/Frame.nwiki not present")
        out = build_nwiki(frame)
        self.assertIn("#87ceeb", out.lower())
        self.assertIn("<:>", out)
        self.assertIn("inline-flex", out)
        self.assertIn("align-items: center", out)
        self.assertIn("margin: -5px -10px", out)

    def test_row_column_stack_sugar(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document

        doc = parse_document(
            "<template>\n"
            "  <Row inline=true crossAxisAlignment=.center spacing=4>\n"
            '    <Text text="A" />\n'
            '    <Text text="B" />\n'
            "  </Row>\n"
            "  <Column crossAxisAlignment=.start mainAxisAlignment=.center>\n"
            '    <Text text="C" />\n'
            "  </Column>\n"
            "</template>\n"
        )
        out = render_document(doc)
        self.assertIn("display: inline-flex", out)
        self.assertIn("flex-direction: row", out)
        self.assertIn("gap: 4px", out)
        self.assertIn("flex-direction: column", out)
        self.assertIn("align-items: flex-start", out)
        self.assertIn("justify-content: center", out)

    def test_table_column_alignment_prefix(self) -> None:
        from engine.nwiki.parser import parse_document
        from engine.nwiki.render import render_document

        doc = parse_document(
            "<template>\n"
            "  <Table>\n"
            "    <TableRow>\n"
            "      <TableColumn alignment=.center>\n"
            '        <Text text="x" />\n'
            "      </TableColumn>\n"
            "    </TableRow>\n"
            "  </Table>\n"
            "</template>\n"
        )
        out = render_document(doc)
        self.assertIn("||<:>", out)


if __name__ == "__main__":
    unittest.main()
