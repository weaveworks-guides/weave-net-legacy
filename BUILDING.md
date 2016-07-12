# Motivation

When there is a lot of duplication in our guides, they are harder to maintain.

For example, the way you set up Weave Net may change from one release to the next.
If the guides always install the latest version of Weave Net, it is very arduous and easy to forget to update the instructions in all of the guides.

The solution to this problem is to "factor out" common content into "component" files which can be _included_ from many guides.
Componentized guides written in this way can then be built out of other "included" Markdown files.

When a Markdown file A includes another Markdown file B, the contents of the B are substituted into file A at the point at which the `include` statement occurs.

An include statement looks like:
```
{"gitdown": "include", "file": "../../_includes/common-file.md"}
```

In this example, this entire section (between and including the curly braces) will be replaced with the contents of `../../_includes/common-file.md`.

# Building guides

You must be running Docker before you can build a guide.
On a Mac, use [Docker for Mac](https://docs.docker.com/docker-for-mac/).

If a guide folder has a `build.sh` script and a `_README` directory, then it means that the `README.md` can be constructed out of other files by building it.
We call these guides _componentized guides_.

**Do not edit `README.md` files directly in componentized guides.**

If you do, you will lose changes made directly to these files next time the file gets built.

Instead, edit the `_README/README.md` _source file_, and when you want to build the _output file_ `README.md`, run `./build.sh` in your terminal, in the appropriate guide folder (use `cd` to get there).

This will output the built guide into `README.md` in the guide folder.

You should run `./build.sh` before committing the file to the repository.
Make sure that both `_README/README.md` and `README.md` are included in your commit.

Then you can refer to the built `README.md` file in the same way that you normally do when, for example, importing the Markdown into Wordpress.

# Creating a new include-able component

This allows you to "factor out" some content that is common to two or more guides.
This means that the common content is easier to maintain: for example, it doesn't need to be updated in many places when it changes.

Create a new file in the top-level `_includes` folder, for example `_includes/running-weave-net-vagrant.md`.

Then in a componentized guide source file, you can include it, for example like this:

```
{"gitdown": "include", "file": "../../_includes/running-weave-net-vagrant.md"}
```

Don't forget to add your include-able file to Git before you commit and push!

# Creating a new componentized guide

There is a sample componentized guide that you can use in `example-componentized-guide` folder.
You can copy this into a new guide folder called `new-guide` with (assuming you're in an appropriate `git` branch, and in the root folder of the `guides` repo):

```
cp -r example-componentized-guide new-guide
cd new-guide
./build.sh
git add .
git commit -am "Create new componentized guide new-guide"
```

# Modifying an existing guide so that it can use includes

Follow the following instructions, substitituing `name-of-guide` for the guide you want to turn into a componentized guide (assuming you're in an appropriate `git` branch, and in the root folder of the `guides` repo):

```
cd name-of-guide
mkdir _README
mv README.md _README/README.md
ln -s ../_includes/build.sh build.sh
chmod +x build.sh
./build.sh
git add _README/README.md build.sh
git commit -am "Convert name-of-guide into componentized guide."
```
