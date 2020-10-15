# Line Note

Line Note is VSCode extension to add notes to the line of code.

[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=tkrkt.linenote)

## Features

Select lines and invoke `Add note at current position` from the command palette or context menu.
You can see the note you wrote as hover text.

Notes are saved in `$PROJECT_ROOT/.vscode/linenote` like `.vscode/linenote/path/to/code.js#L13-L42.md`.

![example](https://i.imgur.com/KlQtCsL.gif)

## Tips

- You can put hyperlinks in notes by writing `#L42` or `../foo.js#L12-L15`.
- You can change the severity/color of the note with #low, #medium, #high tags
