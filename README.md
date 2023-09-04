# Line Note Plus

Line Note Plus is a VSCode extension to add Markdown notes to your code
that are visible when hovering over the noted line. Based on [Line Note](https://github.com/tkrkt/linenote).

<img width="1090" alt="basic-demo" src="https://github.com/prmichaelsen/linenoteplus/assets/8428140/0ecb3057-2334-4413-b0aa-71889ae14a6b">

[VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=prmichaelsen.linenoteplus)

## Features

Invoke `Add note at current position` from the command palette or context menu.
You can see the note you wrote as hover text.

Notes are saved by default in `$PROJECT_ROOT/.vscode/.linenoteplus` like `.vscode/.linenoteplus/<short-uid>.md`.

### Overview
* Edit/open or remove note via Cmd + Click
* Markdown note previews on hover
* Right-click to add note to line
* Right-click to reveal notated line
* Delete a note marker by manually deleting in text editor
* Add a note marker by manually typing in text editor
* Custom note names
* Command to add note
* Command to edit/open note
* Command to remove note
* Command to reveal notated line
* Notes move with code changes
* Notes can be moved between files
* Notes are not affected by refactors
* Add notes within your notes
* Customize notes directory, note marker background color, and annoted line ruler color
* Configure to delete orphaned notes `on-save`, `on-inteveral`, `on-save-and-on-interval`, or `never`

### API
#### Commands
* `linenouteplus.addNote`: Add note at current position (Annotate Line)
* `linenouteplus.openNote`: Edit note at current position (Open Note)
* `linenouteplus.revealLine`: Reveal line in notated file (Show Note Marker)
* `linenouteplus.removeNote`: Remove note at current position (Delete Note)

#### Configuration
- `linenoteplus.cleanUpOrphanedNotesInterval`: Interval at which to clean up unused notes in the background in ms. Only applies if `cleanUpOrphanedNotes` is set to `on-interval` or `on-save-and-on-interval`. Default: `60000` (60s). For performance, a larger value is recommended.
- `linenoteplus.cleanUpOrphanedNotes`: Defines the cleanup behavior for orphaned notes. It can be set to `on-save`, `on-interval`, `on-save-and-on-interval`, or `never`. Default: `on-save-and-on-internal`. Note that when using `on-save` or `on-save-and-on-interval`, if you delete a note marker and save the file then your note file will also be deleted.
- `linenoteplus.includePaths`: Specifies file pattern globs to scan for note markers. Directories that don't match these patterns will be ignored.
- `linenoteplus.gutterIconPath`: File path of the icon to be displayed in gutter.
- `linenoteplus.lineColor`: Sets the background color for inline note markers (Name, HEX, or RGB).
- `linenoteplus.rulerColor`: Sets the ruler color for notated lines (Name, HEX, or RGB).
- `linenoteplus.showGutterIcon`: Whether to display the gutter icon in the gutter for a noted line. Default: `true`.

### Demos
#### Adding a note
![add-note](https://github.com/prmichaelsen/linenoteplus/assets/8428140/85a41396-6ea5-4621-9621-ac77972448b1)

#### Custom note title
![custom-name](https://github.com/prmichaelsen/linenoteplus/assets/8428140/558907e7-538a-49c3-9099-45daed825b37)

#### Notes move with code changes
![moves-with-code](https://github.com/prmichaelsen/linenoteplus/assets/8428140/569280b2-3b65-4872-8a8a-85d5011c8f8c)

#### Notes can be moved across files
![move-notes-across-files](https://github.com/prmichaelsen/linenoteplus/assets/8428140/cdb578c8-7a0f-4894-ad4c-dba5f71f2d00)


#### Reveal notated line command
![reveal-notated-file](https://github.com/prmichaelsen/linenoteplus/assets/8428140/e3d4f76a-67e1-4603-abd4-8a3dcedec15a)

#### Refactor does not affect notes
![refactor-does-not-affect-notes](https://github.com/prmichaelsen/linenoteplus/assets/8428140/d034f397-ebd7-4fa6-9843-4cb3f2c26c9e)


### Acknowledgements
Line Note Plus is a fork of Line Note by tkrkt. This library's design
was also informed by Marginalia by indiejames.
* https://github.com/tkrkt/linenote
* https://github.com/indiejames/marginalia


### Known Bugs
* Gutter icon does not display.