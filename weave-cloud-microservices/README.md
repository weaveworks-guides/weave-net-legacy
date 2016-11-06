This directory uses componentized builds.

Only deploy from the `_output` directory.

Run `./build.sh` to update the `_output` directory based on changes you make to the `*.md` files.

Open the resulting Markdown in Atom with Markdown Preview Plus installed.
Use Atom editor with 'Markdown Preview Plus' to open one of the `_output/_*.md` files created by build.sh and press ctrl+shift+m to render it to HTML

Right click on the HTML preview and 'Save as HTML...'

Run `convert.py _output/_file.md.html`

If you do this for all the files, you can run: `for X in _output/*.md.html; do ./convert.py $X; done`
