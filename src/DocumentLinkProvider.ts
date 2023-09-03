import { DocumentLink, DocumentLinkProvider, Position, ProviderResult, Range, TextDocument, Uri } from "vscode";
import { Note } from "./note";
import { getNotePrefix } from "./util";

export const editText = '[Edit]';
export const removeText = '[Remove]';
export class NoteLinkProvider implements DocumentLinkProvider {
  provideDocumentLinks(document: TextDocument): ProviderResult<DocumentLink[]> {
    const links: DocumentLink[] = [];
    const text = document.getText();
    const uuids = Note.matchUuids(text);
    for (const uuid of uuids) {
      const lineIndex = Note.getLine(document, uuid);
      const line = document.lineAt(lineIndex);
      const editIndex = line.text.indexOf(editText);
      const editPosition = new Position(line.lineNumber, editIndex);
      const editEndPosition = new Position(line.lineNumber, editIndex + editText.length);
      const editRange = new Range(editPosition, editEndPosition);
      const editUri = Uri.parse(
        `command:linenote.openNote?${encodeURIComponent(
          JSON.stringify(uuid)
        )}`
      );
      const removeIndex = line.text.indexOf(removeText);
      const removePosition = new Position(line.lineNumber, removeIndex);
      const removeEndPosition = new Position(line.lineNumber, removeIndex + removeText.length);
      const removeRange = new Range(removePosition, removeEndPosition);
      const removeUri = Uri.parse(
        `command:linenote.removeNote?${encodeURIComponent(
          JSON.stringify(uuid)
        )}`
      );
      const openPosition = new Position(line.lineNumber, line.text.indexOf(getNotePrefix()));
      const openEndPosition = new Position(line.lineNumber, editIndex - 1);
      const openRange = new Range(openPosition, openEndPosition);
      const openLink = new DocumentLink(openRange, editUri);
      const editLink = new DocumentLink(editRange, editUri);
      const removeLink = new DocumentLink(removeRange, removeUri);
      links.push(openLink, editLink, removeLink);
    }

    return new Promise((res) => res(links));
  }
}
