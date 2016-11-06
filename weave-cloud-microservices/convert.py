#!/usr/bin/python
import os, sys
if len(os.argv) == 1:
    print """Usage:
    * Use Atom editor with 'Markdown Preview Plus' to open one of the _output/_*.md files created by build.sh
    * convert.py _output/_file.md.html
    """
    sys.exit(1)
html = open(os.argv[1]).read()
start = "<body class='markdown-preview' data-use-github-style>"
end = "</html>"
html = html.split(start)[1]
html = html.split(end)[0]
html = html.replace("/Users/luke/Projects/Weave/guides/weave-cloud-microservices/_output/", "/wp-content/uploads/")
print html
