#!/usr/bin/python
#

import json
import argparse
import re

def updateConfig(gp, op, configJson):

    for guide in configJson['guides']:
        inFile =  gp + "/" + guide['indir'] + "/README.md"
        inImage = gp + "/" + guide['image'] 
        outFile = op + "/" + guide['outfile']
        outImage = op + "/" + guide['image']
        layout = guide['layout']
        markdown = guide['markdown']
        highlighter = guide['highlighter']
        keywords = guide['keywords']

        ( title, jekyll)  = fixupReadMe(inFile)

        g = open(outFile, "w")
        print >>g, "---"
        print >>g, "layout: " + layout
        print >>g, "title: " + title
        print >>g, "description: " + title
        print >>g, "keywords: " + keywords
        print >>g, "markdown: " + markdown
        print >>g, "highlighter: " + highlighter
        print >>g, "---\n"
        print >>g, jekyll + "\n"
        g.close

def fixupReadMe(inFile):

    title = ""
    jekyll = ""
    doEnd = None

    with open(inFile, 'r+') as f:
        for line in f:
            line = re.sub("\s+$", "", line)

            # this seems horribly inefficent...
            foundTitle = re.match("^#\s(.*)\s#", line)
            foundStart = re.match("^```(bash|javascript|php|java|ruby|python)$", line)
            foundEnd = re.match("^```$", line)
            foundPng = re.match("(^\!\[.*\])\(.*\/(.*\.png)\)$", line)

            if ( foundTitle ):
                title = foundTitle.group(1)

            elif ( foundStart ):
                jekyll = jekyll + "{% highlight " + foundStart.group(1) + " %}\n"
                doEnd = "Yes"

            elif ( ( foundEnd ) and ( doEnd == "Yes" ) ):
                jekyll = jekyll + "{% endhighlight %}\n"
                doEnd = None

            elif ( foundPng ):
                jekyll = jekyll + foundPng.group(1) + "("
                jekyll = jekyll + foundPng.group(2) + ")\n\n"

            else:
                jekyll = jekyll + line + "\n"

    return (title, jekyll)

def loadConfigDetails(jsonFile):
    with open(jsonFile, 'r+') as f:
        configJson = json.load(f)

    return configJson

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("-g", help="Local Github Repo Containing Guides", required=True)
    parser.add_argument("-o", help="Output Directory, defaults to /tmp", default="/tmp")
    parser.add_argument("-c", help="Config file, defaults to guides.json", default="guides.json")
    args = parser.parse_args()
    configJson = loadConfigDetails(args.c)
    updateConfig(args.g, args.o, configJson)
