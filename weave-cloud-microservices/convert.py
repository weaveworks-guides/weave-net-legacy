#!/usr/bin/python
import sys
if len(sys.argv) == 1:
    print """Usage:
    * Use Atom editor with 'Markdown Preview Plus' to open one of the _output/_*.md files created by build.sh
    * Right click on the file and 'Save as HTML...'
    * convert.py _output/_file.md.html
This will save the resulting 'tidied up' file as _output/_file.html
Open it in Atom and copy and paste it into Wordpress.
    """
    sys.exit(1)
html = open(sys.argv[1]).read()
start = "<body class='markdown-preview' data-use-github-style>"
end = "</html>"
html = html.split(start)[1]
html = html.split(end)[0]
html = html.replace("/Users/luke/Projects/Weave/guides/weave-cloud-microservices/_output/", "/wp-content/uploads/")
f = open(sys.argv[1].replace(".md.html", ".html"), 'w')
f.write(html)
f.close()
