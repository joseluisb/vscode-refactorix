import * as vs from 'vscode';
import * as ts from 'typescript';
import {singleStatementBlockToExpressions, expressionToBlock as coreExpressionToBlock} from './arrow-function';
import {getIndentAtLine, getTabs, ParseDiagnostics, changeToRange, selectionToSpan} from './refactor-vscode';

export function expressionToBlock() {
    const editor = vs.window.activeTextEditor;
    if (!editor) {
        return;
    }
    const doc = editor.document;
    const sourceFile: ParseDiagnostics = <any>ts.createSourceFile(doc.fileName, doc.getText(), ts.ScriptTarget.ES6, true);
    if (sourceFile.parseDiagnostics.length > 0) {
        return;
    }

    const sel = editor.selection;

    const change = coreExpressionToBlock(sourceFile, selectionToSpan(doc, sel), getIndentAtLine(doc, sel.start.line), getTabs(editor, 1));
    if (!change) {
        return;
    }

    editor.edit(builder => builder.replace(changeToRange(doc, change), change.newText))
        .then(ok => {
            if (ok) {
                editor.selection = sel;
            }
        });
}

export function singleStatementBlockToExpression(replaceAll: boolean) {
    const editor = vs.window.activeTextEditor;
    if (!editor) {
        return;
    }

    let overlapRecursionsLeft = 10;

    (function doIt() {
        const doc = editor.document;
        const sourceFile: ParseDiagnostics = <any>ts.createSourceFile(doc.fileName, doc.getText(), ts.ScriptTarget.ES6, true);
        if (sourceFile.parseDiagnostics.length > 0) {
            return;
        }

        const sel = editor.selection;

        let all = singleStatementBlockToExpressions(sourceFile, replaceAll ? undefined : selectionToSpan(doc, sel));
        if (all.changes.length === 0) {
            return;
        }

        if (!replaceAll) {
            all.changes = [all.changes[0]];
        }

        editor.edit(builder =>
            all.changes.forEach(change => builder.replace(changeToRange(doc, change), change.newText)))
            .then(ok => {
                if (ok) {
                    editor.selection = sel;
                    if (replaceAll && all.changes.length > 1 && all.overlaps && overlapRecursionsLeft > 0) {
                        doIt();
                        overlapRecursionsLeft--;
                    }
                }
            });
    })();
}
