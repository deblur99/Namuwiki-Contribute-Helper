import {
  designSystemImportPath,
  escapeNwikiString,
  profileTableImportPath,
} from "./docTitle";

/** Keep in sync with snippets/nwiki.json (nwframe / nwprofile / nwpage). */

export function frameTemplate(title: string, filePath: string): string {
  const t = escapeNwikiString(title);
  const ds = designSystemImportPath(filePath);
  const short = escapeNwikiString(shortDisplayName(title));
  return `frame("${t}")

import DesignSystem from "${ds}"

category("둘러보기 틀")
category("${t}")

<template>
  <Table width=LayoutLength(100 .percent) bgColor=HexColor("\${DesignSystem.accentColor}")>
    <TableRow>
      <TableColumn alignment=.center>
        <Link toDocument="${t}">
          <Box display=.flex flexDirection=.row justifyContent=.center alignItems=.center>
            <Image fileName="로고.png" width=LayoutLength(100) />
            <Box display=.flex flexDirection=.column alignItems=.flexStart>
              <Text text="${short}" size=.step(1) color=HexColor("\${DesignSystem.white}") weight=.bold />
              <Text text="관련 문서" size=.step(-1) weight=.bold color=HexColor("\${DesignSystem.white}") />
            </Box>
          </Box>
        </Link>
      </TableColumn>
    </TableRow>
    <TableRow>
      <TableColumn alignment=.center delimiter=" · " bgColor="\${DesignSystem.defaultBgColor}">
        <Link toDocument="${t}">
          <Text text="소개" size=.step(-2) />
        </Link>
        <Link toDocument="${t}/하위">
          <Text text="하위" size=.step(-2) />
        </Link>
        <Link toDocument="${t}#s-2">
          <Text text="여담" size=.step(-2) />
        </Link>
      </TableColumn>
    </TableRow>
  </Table>
</template>
`;
}

export function profileTableTemplate(title: string): string {
  const short = escapeNwikiString(shortDisplayName(title));
  return `props {
  name: String
}

<template>
  <Table
    width=LayoutLength(500)
    align=.right
    borderColor=HexColor("#00BFFF")
    bgColor=HexColor(light="#FFFFFF" dark="#1C1D1F")>

    <TableRow>
      <TableColumn colSpan=2 bgColor=HexColor("#87CEEB")>
        <TitleText text="\${props.name}" />
      </TableColumn>
    </TableRow>

    <TableRow>
      <TableColumn colSpan=2 nopad=true>
        <Image fileName="프로필.jpg" width=LayoutLength(100 .percent) />
      </TableColumn>
    </TableRow>

    <TableRow>
      <TableColumn width=LayoutLength(85)>
        <Text text="본명" weight=.bold />
      </TableColumn>
      <TableColumn>
        <Text text="${short}" />
      </TableColumn>
    </TableRow>

    <TableRow>
      <TableColumn width=LayoutLength(85)>
        <Text text="출생" weight=.bold />
      </TableColumn>
      <TableColumn>
        <Text text="YYYY년 M월 D일" />
      </TableColumn>
    </TableRow>
  </Table>
</template>
`;
}

export function articleTemplate(title: string, filePath: string): string {
  const t = escapeNwikiString(title);
  const short = escapeNwikiString(shortDisplayName(title));
  const ds = designSystemImportPath(filePath);
  const pt = profileTableImportPath(filePath);
  return `document("${t}")

import DesignSystem from "${ds}"
import ProfileTable from "${pt}"

category("${t}")
includeFrame("${t}")

<template>
  <ProfileTable name="${short}" />
  <Heading toDocument="./하위" title="하위" />
  <Heading title="여담">
    <Quote>
    </Quote>
    <Text text="" />
  </Heading>
</template>
`;
}

/** Drop parenthetical disambiguator. */
function shortDisplayName(title: string): string {
  const m = /^(.+?)\s*\([^)]*\)\s*$/.exec(title.trim());
  return m ? m[1].trim() : title.trim();
}
