/**
 * Semantic tokens: reserved types vs import bindings (custom types → no link underline).
 */

import * as vscode from "vscode";
import {
  RESERVED_TYPES,
  collectImportBindings,
  inComment,
  rangesForWord,
} from "./semanticTokensCore";

export { RESERVED_TYPES, collectImportBindings } from "./semanticTokensCore";

/** Custom types so themes don't style them as navigable `namespace` / `type` links. */
const TOKEN_TYPES = ["nwikiReserved", "nwikiImport"] as const;
type TokenType = (typeof TOKEN_TYPES)[number];

const legend = new vscode.SemanticTokensLegend([...TOKEN_TYPES]);

export class NwikiSemanticTokensProvider
  implements vscode.DocumentSemanticTokensProvider
{
  provideDocumentSemanticTokens(
    document: vscode.TextDocument
  ): vscode.ProviderResult<vscode.SemanticTokens> {
    const text = document.getText();
    const builder = new vscode.SemanticTokensBuilder(legend);
    const imports = collectImportBindings(text);

    const push = (start: number, length: number, type: TokenType) => {
      if (inComment(text, start)) return;
      const pos = document.positionAt(start);
      builder.push(pos.line, pos.character, length, TOKEN_TYPES.indexOf(type));
    };

    for (const name of RESERVED_TYPES) {
      for (const r of rangesForWord(text, name)) {
        push(r.start, r.length, "nwikiReserved");
      }
    }

    for (const name of imports) {
      if (RESERVED_TYPES.has(name)) continue;
      for (const r of rangesForWord(text, name)) {
        push(r.start, r.length, "nwikiImport");
      }
    }

    return builder.build();
  }
}

export function registerSemanticTokens(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "nwiki" },
      new NwikiSemanticTokensProvider(),
      legend
    )
  );
}
