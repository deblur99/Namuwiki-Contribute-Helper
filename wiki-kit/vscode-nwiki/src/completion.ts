import * as vscode from "vscode";
import {
  ATTR_DOCS,
  CALLS,
  attrKindLabel,
  attrReq,
  TAG_ATTRS,
  TAG_DOCS,
  TAGS,
  tagCompletionSnippet,
  VALUE_SNIPPETS,
} from "./catalog";
import {
  ATTR_LIST_ATTRS,
  attrEnumQuery,
  attrTypeMemberQuery,
  callKwargValueEnumQuery,
  findOpenTagName,
  inAttrValuePosition,
  inOpenTagString,
  openCallFromText,
  openTagFullFromText,
  openTagPrefixFromText,
  presentAttrsInOpenTag,
  unsetCallKwargs,
} from "./completionContext";
import {
  componentPropCompletions,
  loadImportedComponentProps,
} from "./componentProps";
import { collectImportedTags } from "./diagnostics";
import { resolveDocsForSymbol } from "./docs";
import { jsonKeyCompletions, loadJsonNamespaces } from "./jsonData";
import {
  COMMON_FRAME_MEMBERS,
  KNOWN_TYPE_NAMES,
  TYPE_DOCS,
  TYPE_MEMBERS,
  TypeMember,
} from "./members";

export class NwikiCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const line = document.lineAt(position).text;
    const linePrefix = line.slice(0, position.character);
    const offset = document.offsetAt(position);
    const docText = document.getText();
    const tagPrefix = openTagPrefixFromText(docText, offset) ?? undefined;
    const tagFull = openTagFullFromText(docText, offset) ?? undefined;
    const items: vscode.CompletionItem[] = [];
    const jsonNs = loadJsonNamespaces(document);
    const compProps = loadImportedComponentProps(document);

    const call = openCallFromText(docText, offset);

    // Space: constructor kwargs (Spacing/Border/…) first, else unset tag attrs
    if (context.triggerCharacter === " ") {
      if (call) {
        return callKwargCompletions(call) ?? [];
      }
      const openName = findOpenTagName(tagFull ?? tagPrefix ?? linePrefix);
      if (openName && compProps.has(openName)) {
        const present = presentAttrsInOpenTag(tagFull ?? tagPrefix ?? linePrefix);
        return componentPropCompletions(
          compProps.get(openName)!,
          present
        );
      }
      return (
        attributeCompletions(tagPrefix ?? linePrefix, tagFull) ?? []
      );
    }

    // Prefer tag-scoped prefix for attr/enum; else current line
    const prefix = tagPrefix ?? linePrefix;

    // Inside Spacing(… / Border(… — label value enums (vertical: .auto)
    if (call) {
      const cq = callKwargValueEnumQuery(call);
      if (cq) return enumStringItems(cq.values, cq.afterDot);
      const kw = callKwargCompletions(call);
      if (kw?.length && /[A-Za-z_]$/.test(call.inside)) return kw;
    }

    // JSON data keys: ${designSystem. / designSystem.
    const jsonDot =
      /(?:\$\{)?([A-Za-z_][\w]*)\.\w*$/.exec(linePrefix) ||
      /(?:\$\{)?([A-Za-z_][\w]*)\.$/.exec(linePrefix);
    if (jsonDot && jsonNs.has(jsonDot[1])) {
      return jsonKeyCompletions(jsonNs, jsonDot[1]);
    }

    // 1) includeFrame( / include( + `.` → CommonFrame
    if (/\b(?:includeFrame|include)\s*\(\s*\.?[\w]*$/.test(linePrefix)) {
      return memberItems(COMMON_FRAME_MEMBERS, {
        replaceDot: /\.\w*$/.test(linePrefix),
      });
    }

    // 3) Type. → init / method / prop / enum
    const typeDot = /([A-Za-z_][\w]*)\.\w*$/.exec(linePrefix);
    if (typeDot && KNOWN_TYPE_NAMES.includes(typeDot[1])) {
      const info = TYPE_MEMBERS[typeDot[1]];
      const members = info.members.filter(
        (m) =>
          m.kind === "init" ||
          m.kind === "method" ||
          m.kind === "prop" ||
          m.kind === "enum"
      );
      return memberItems(members, {
        forTypeDot: typeDot[1],
        replaceDot: true,
      });
    }

    // 4) Value/call behind `.` → prop / method (HexColor("#fff"). / LayoutLength(1).)
    const instDot =
      /(?:([A-Za-z_][\w]*)\s*\([^)]*\)|"[^"]*"|'[^']*'|\))\.\w*$/.exec(
        linePrefix
      );
    if (instDot) {
      const typeName = inferReceiverType(linePrefix);
      if (typeName && TYPE_MEMBERS[typeName]) {
        const inst = TYPE_MEMBERS[typeName].members.filter(
          (m) => m.kind === "prop" || m.kind === "method"
        );
        if (inst.length) {
          return memberItems(inst, { replaceDot: true });
        }
      }
      return [];
    }

    // 2) attr= `.` / attr=[… . → ATTR_ENUMS (list + scalar; hyphen ok)
    const enumQ = attrEnumQuery(prefix);
    if (enumQ) {
      return enumStringItems(enumQ.values, enumQ.afterDot);
    }

    // 2b) attr=. → typed static/enum members (size=. → TextSize.step)
    const typeMemQ = attrTypeMemberQuery(prefix);
    if (typeMemQ) {
      return memberItems(typeMemQ.members, {
        forTypeDot: typeMemQ.typeName,
        replaceDot: true,
      });
    }

    // Call-arg `.` heuristics: LayoutLength(n, . / LinearGradient(. / Border(… style: .
    const callArgEnums = callArgEnumSuggestions(linePrefix);
    if (callArgEnums) {
      return enumStringItems(callArgEnums, true);
    }

    // Tag name after < — insert required (+ oneOf representative) attrs
    const tagMatch = /<\/?([A-Za-z_]*)$/.exec(linePrefix);
    if (tagMatch) {
      const isClose = /<\/[A-Za-z_]*$/.test(linePrefix);
      const tagNames = new Set<string>([
        ...TAGS,
        ...collectImportedTags(document.getText()),
      ]);
      for (const t of tagNames) {
        const item = new vscode.CompletionItem(
          t,
          vscode.CompletionItemKind.Class
        );
        if (isClose || !TAG_ATTRS[t]) {
          item.insertText = t;
        } else {
          item.insertText = new vscode.SnippetString(tagCompletionSnippet(t));
        }
        const doc =
          resolveDocsForSymbol(document, t) || TAG_DOCS[t] || undefined;
        if (doc) {
          item.documentation = new vscode.MarkdownString(doc);
        }
        items.push(item);
      }
      return items;
    }

    // Attributes inside open tag (also after typing attr name prefix)
    const attrItems = attributeCompletions(prefix, tagFull);
    if (attrItems) items.push(...attrItems);
    const openComp = findOpenTagName(tagFull ?? prefix);
    if (openComp && compProps.has(openComp)) {
      const present = presentAttrsInOpenTag(tagFull ?? prefix);
      items.push(
        ...componentPropCompletions(compProps.get(openComp)!, present)
      );
    }

    // After = suggest type constructors / value snippets (not global enum dump)
    if (/=\s*[\w]*$/.test(prefix) || /=\s*$/.test(prefix)) {
      const again = attrEnumQuery(prefix);
      if (again) {
        items.push(...enumStringItems(again.values, again.afterDot));
      }
      for (const v of VALUE_SNIPPETS) {
        const item = new vscode.CompletionItem(
          v,
          vscode.CompletionItemKind.Value
        );
        item.insertText = v;
        items.push(item);
      }
      for (const typeName of KNOWN_TYPE_NAMES) {
        if (typeName === "CommonFrame") continue;
        const inits = TYPE_MEMBERS[typeName].members.filter(
          (m) => m.kind === "init"
        );
        for (const m of inits) {
          items.push(memberToItem(m));
        }
      }
      items.push(
        new vscode.CompletionItem("true", vscode.CompletionItemKind.Keyword)
      );
      items.push(
        new vscode.CompletionItem("false", vscode.CompletionItemKind.Keyword)
      );
    }

    // Top-level calls
    const trimmed = linePrefix.trimStart();
    if (/^[a-zA-Z]*$/.test(trimmed)) {
      for (const c of CALLS) {
        const item = new vscode.CompletionItem(
          c,
          vscode.CompletionItemKind.Function
        );
        if (c === "import") {
          item.insertText = new vscode.SnippetString(
            'import ${1:DesignSystem} from "${2:./data/design-system.json}"'
          );
          item.documentation = new vscode.MarkdownString(
            '`import Name from "path"` — `.json` → 네임스페이스, `.nwiki` → 컴포넌트 태그'
          );
        } else if (c === "includeFrame") {
          item.insertText = new vscode.SnippetString(
            "includeFrame(.${1|adult,spoiler,parentDocument,relatedDocuments,discussion|})"
          );
        } else if (c === "include") {
          item.insertText = new vscode.SnippetString(
            'include("${1:틀:이름}")'
          );
        } else if (c === "category") {
          item.insertText = new vscode.SnippetString(
            'category("${1:분류}")'
          );
        } else if (c === "document") {
          item.insertText = new vscode.SnippetString(
            'document("${1:문서명}")'
          );
          item.documentation = new vscode.MarkdownString(
            "현재 문서명. `toDocument=\"./…\"` / `\"../…\"` 해석 기준."
          );
        } else if (c === "frame") {
          item.insertText = new vscode.SnippetString(
            'frame("${1:틀제목}")'
          );
          item.documentation = new vscode.MarkdownString(
            '`frame("이름")` = `document("틀:이름")`. 둘러보기 틀 파일용.'
          );
        } else {
          item.insertText = new vscode.SnippetString(`${c}("\${1}")`);
        }
        items.push(item);
      }
    }

    return items;
  }
}

function memberItems(
  members: TypeMember[],
  opts: { replaceDot?: boolean; forTypeDot?: string } = {}
): vscode.CompletionItem[] {
  return members.map((m) => memberToItem(m, opts));
}

function memberToItem(
  m: TypeMember,
  opts: { replaceDot?: boolean; forTypeDot?: string } = {}
): vscode.CompletionItem {
  const kind =
    m.kind === "enum"
      ? vscode.CompletionItemKind.EnumMember
      : m.kind === "init"
        ? vscode.CompletionItemKind.Constructor
        : m.kind === "method"
          ? vscode.CompletionItemKind.Method
          : vscode.CompletionItemKind.Property;

  const item = new vscode.CompletionItem(m.name, kind);
  item.detail = m.detail;
  const docs =
    m.documentation ||
    (opts.forTypeDot ? TYPE_DOCS[opts.forTypeDot] : undefined);
  if (docs) {
    item.documentation = new vscode.MarkdownString(docs);
  }
  let insert = m.insert;
  if (opts.forTypeDot) {
    // Type. already typed — insert only the member part
    if (m.kind === "init") {
      // HexColor("…") → ("…") or keep full if insert starts with Type
      if (insert.startsWith(opts.forTypeDot)) {
        insert = insert.slice(opts.forTypeDot.length);
      }
    } else if (m.kind === "enum") {
      insert = insert.startsWith(".") ? insert.slice(1) : insert;
    }
  } else if (opts.replaceDot && insert.startsWith(".")) {
    // cursor after `.` — don't double the dot
    insert = insert.slice(1);
  }
  item.insertText = insert.includes("$")
    ? new vscode.SnippetString(insert)
    : insert;
  return item;
}

function enumStringItems(
  values: string[],
  afterDot: boolean
): vscode.CompletionItem[] {
  return values.map((e) => {
    const item = new vscode.CompletionItem(
      e,
      vscode.CompletionItemKind.EnumMember
    );
    let insert = e;
    if (afterDot && insert.startsWith(".")) {
      insert = insert.slice(1);
    }
    item.insertText = insert;
    item.filterText = e;
    return item;
  });
}

function inferReceiverType(prefix: string): string | undefined {
  const call = /([A-Za-z_][\w]*)\s*\([^)]*\)\.\w*$/.exec(prefix);
  if (call && KNOWN_TYPE_NAMES.includes(call[1])) return call[1];
  return undefined;
}

function callArgEnumSuggestions(prefix: string): string[] | undefined {
  if (!/\.\w*$/.test(prefix) && !/\(\s*$/.test(prefix) && !/,\s*$/.test(prefix)) {
    if (!/\.\w*$/.test(prefix)) return undefined;
  }
  if (!/\.\w*$/.test(prefix)) return undefined;

  if (/LayoutLength\s*\([^)]*$/.test(prefix)) {
    return [".percent", ".point"];
  }
  if (/TextSize\s*\([^)]*$/.test(prefix)) {
    return [".rem", ".pt"];
  }
  if (/LinearGradient\s*\(\s*\.?[\w]*$/.test(prefix)) {
    return [
      ".toRight",
      ".toLeft",
      ".toBottom",
      ".toTop",
      ".toBottomRight",
      ".toBottomLeft",
      ".toTopRight",
      ".toTopLeft",
    ];
  }
  if (/RadialGradient\s*\(\s*\.?[\w]*$/.test(prefix)) {
    return [".circle", ".ellipse"];
  }
  if (/Border\s*\([^)]*style:\s*\.?[\w]*$/.test(prefix)) {
    return [".solid", ".dashed", ".dotted", ".double", ".none"];
  }
  if (/ColorStop\s*\([^)]*$/.test(prefix)) {
    return [".transparent"];
  }
  return undefined;
}

function callKwargCompletions(
  call: NonNullable<ReturnType<typeof openCallFromText>>
): vscode.CompletionItem[] | undefined {
  const labels = unsetCallKwargs(call);
  if (!labels?.length) return undefined;
  return labels.map((label) => {
    const item = new vscode.CompletionItem(
      label,
      vscode.CompletionItemKind.Property
    );
    item.insertText = new vscode.SnippetString(`${label}: $0`);
    item.detail = `${call.name}(…) kwarg`;
    item.sortText = `0_${label}`;
    return item;
  });
}

/**
 * Unset attribute completions inside `<Tag …`.
 * Skips when inside strings, after `=`, or not in an open tag.
 * `tagFull` (entire `<Tag…>`) excludes attrs that appear after the cursor.
 */
function attributeCompletions(
  prefix: string,
  tagFull?: string
): vscode.CompletionItem[] | undefined {
  const openTag = findOpenTagName(prefix);
  if (!openTag) return undefined;
  if (inOpenTagString(prefix)) return undefined;
  if (inAttrValuePosition(prefix)) return undefined;

  const attrs = TAG_ATTRS[openTag] ?? [];
  if (!attrs.length) return undefined;

  const present = presentAttrsInOpenTag(tagFull ?? prefix);
  const items: vscode.CompletionItem[] = [];
  for (const a of attrs) {
    if (present.has(a)) continue;
    const item = new vscode.CompletionItem(
      a,
      vscode.CompletionItemKind.Property
    );
    const snip = ATTR_LIST_ATTRS.has(a) ? `${a}=[$0]` : `${a}=$0`;
    item.insertText = new vscode.SnippetString(snip);
    const req = attrReq(openTag, a);
    const kind = req ? attrKindLabel(req) : "";
    const docLine = ATTR_DOCS[a] ?? "";
    item.detail = [kind, docLine].filter(Boolean).join(" ");
    if (docLine) {
      item.documentation = new vscode.MarkdownString(
        `${kind} ${docLine}`.trim()
      );
    }
    if (req?.kind === "required") item.sortText = `0_${a}`;
    else if (req?.kind === "oneOf") item.sortText = `1_${a}`;
    else item.sortText = `2_${a}`;
    items.push(item);
  }
  return items;
}
