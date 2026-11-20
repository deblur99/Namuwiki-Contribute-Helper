import * as vscode from "vscode";
import {
  ATTR_DOCS,
  CALLS,
  TAG_ATTRS,
  TAG_DOCS,
  TAGS,
  VALUE_SNIPPETS,
} from "./catalog";
import { collectImportedTags } from "./diagnostics";
import { resolveDocsForSymbol } from "./docs";
import {
  ATTR_ENUMS,
  COMMON_FRAME_MEMBERS,
  KNOWN_TYPE_NAMES,
  TYPE_DOCS,
  TYPE_MEMBERS,
  TypeMember,
} from "./members";

export class NwikiCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const line = document.lineAt(position).text;
    const prefix = line.slice(0, position.character);
    const items: vscode.CompletionItem[] = [];

    // 1) includeFrame( / include( + `.` → CommonFrame
    if (/\b(?:includeFrame|include)\s*\(\s*\.?[\w]*$/.test(prefix)) {
      return memberItems(COMMON_FRAME_MEMBERS, {
        replaceDot: /\.\w*$/.test(prefix),
      });
    }

    // 3) Type. → init / static
    const typeDot = /([A-Za-z_][\w]*)\.\w*$/.exec(prefix);
    if (typeDot && KNOWN_TYPE_NAMES.includes(typeDot[1])) {
      const info = TYPE_MEMBERS[typeDot[1]];
      const staticish = info.members.filter(
        (m) =>
          m.kind === "init" ||
          m.kind === "staticMethod" ||
          m.kind === "staticProp" ||
          m.kind === "enum"
      );
      return memberItems(staticish, {
        forTypeDot: typeDot[1],
        replaceDot: true,
      });
    }

    // 4) Value/call behind `.` → instance (HexColor("#fff"). / LayoutLength(1).)
    const instDot =
      /(?:([A-Za-z_][\w]*)\s*\([^)]*\)|"[^"]*"|'[^']*'|\))\.\w*$/.exec(prefix);
    if (instDot) {
      const typeName = inferReceiverType(prefix);
      if (typeName && TYPE_MEMBERS[typeName]) {
        const inst = TYPE_MEMBERS[typeName].members.filter(
          (m) => m.kind === "instanceProp" || m.kind === "instanceMethod"
        );
        if (inst.length) {
          return memberItems(inst, { replaceDot: true });
        }
      }
      return [];
    }

    // 2) attr= `.` → expected enum for that attribute
    const attrEq = /([A-Za-z_][\w]*)\s*=\s*\.?[\w]*$/.exec(prefix);
    if (attrEq && ATTR_ENUMS[attrEq[1]]) {
      return enumStringItems(ATTR_ENUMS[attrEq[1]], /\.\w*$/.test(prefix));
    }

    // Call-arg `.` heuristics: LayoutLength(n, . / LinearGradient(. / Border(… style: .
    const callArgEnums = callArgEnumSuggestions(prefix);
    if (callArgEnums) {
      return enumStringItems(callArgEnums, true);
    }

    // Tag name after <
    const tagMatch = /<\/?([A-Za-z_]*)$/.exec(prefix);
    if (tagMatch) {
      const tagNames = new Set<string>([
        ...TAGS,
        ...collectImportedTags(document.getText()),
      ]);
      for (const t of tagNames) {
        const item = new vscode.CompletionItem(
          t,
          vscode.CompletionItemKind.Class
        );
        item.insertText = t;
        const doc =
          resolveDocsForSymbol(document, t) || TAG_DOCS[t] || undefined;
        if (doc) {
          item.documentation = new vscode.MarkdownString(doc);
        }
        items.push(item);
      }
      return items;
    }

    // Attributes inside open tag
    const openTag = findOpenTagName(prefix);
    if (openTag && /=\s*$/.test(prefix) === false && !/["']$/.test(prefix)) {
      const attrs = TAG_ATTRS[openTag] ?? [];
      for (const a of attrs) {
        const item = new vscode.CompletionItem(
          a,
          vscode.CompletionItemKind.Property
        );
        item.insertText = new vscode.SnippetString(`${a}=$0`);
        if (ATTR_DOCS[a]) {
          item.detail = ATTR_DOCS[a];
          item.documentation = new vscode.MarkdownString(ATTR_DOCS[a]);
        }
        items.push(item);
      }
      items.push(
        Object.assign(
          new vscode.CompletionItem(
            "delimiter",
            vscode.CompletionItemKind.Property
          ),
          { detail: "not delimeter" }
        )
      );
    }

    // After = suggest type constructors / value snippets (not global enum dump)
    if (/=\s*[\w]*$/.test(prefix) || /=\s*$/.test(prefix)) {
      const attrName = /([A-Za-z_][\w]*)\s*=\s*[\w]*$/.exec(prefix)?.[1];
      if (attrName && ATTR_ENUMS[attrName]) {
        items.push(
          ...enumStringItems(ATTR_ENUMS[attrName], /\.\w*$/.test(prefix))
        );
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
    const trimmed = prefix.trimStart();
    if (/^[a-zA-Z]*$/.test(trimmed)) {
      for (const c of CALLS) {
        const item = new vscode.CompletionItem(
          c,
          vscode.CompletionItemKind.Function
        );
        if (c === "import") {
          item.insertText = new vscode.SnippetString(
            "import(${1:ProfileTable})"
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
        : m.kind === "staticMethod" || m.kind === "instanceMethod"
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
    // only when typing `.` or empty after ( / ,
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

function findOpenTagName(prefix: string): string | undefined {
  const idx = prefix.lastIndexOf("<");
  if (idx < 0) return undefined;
  const slice = prefix.slice(idx);
  if (slice.includes(">")) return undefined;
  const m = /^<\/?([A-Za-z_][\w-]*)/.exec(slice);
  return m?.[1];
}
