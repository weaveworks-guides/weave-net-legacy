#!/bin/bash
GIT_ROOT=$(git rev-parse --show-toplevel)
# PWD is e.g. /Users/luke/Projects/Weave/guides/foo-guide/x/y/z
# GIT_ROOT is e.g. /Users/luke/Projects/Weave/guides
# GIT_SUFFIX_PATH needs to be "foo-guide/x/y/z",
#     e.g. GIT_ROOT.replace(PWD, "")
GIT_SUFFIX_PATH=$(echo $PWD | sed "s|$GIT_ROOT||")
echo docker run -ti -v $GIT_ROOT:/guides \
    -w /guides$GIT_SUFFIX_PATH lmarsden/gitdown \
    ./_README/README.md \
    --output-file ./README.md
