#!/usr/bin/env python3
"""Stamp a version tag on every stylesheet and script a page links to.

Browsers keep copies of CSS and JS files. GitHub Pages lets them keep a copy
for up to 10 minutes, so a visitor can see an updated page still wearing the
old styles. This script rewrites each link from

    assets/css/style.css   to   assets/css/style.css?v=3f9a1c2e

where the tag is taken from the file's contents. When a file changes, its tag
changes, and browsers fetch the new file straight away instead of reusing
their copy. Files that did not change keep their tag, so they stay cached.

Run it from the top of the repo after changing any CSS or JS:

    python3 tools/stamp-versions.py

It is safe to run any number of times. The pre-commit hook in .githooks runs
it automatically (enable once with: git config core.hooksPath .githooks).
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LINK = re.compile(r'''(?P<attr>(?:href|src)=")(?P<path>(?!https?:|//)[^"?#]+\.(?:css|js))(?:\?v=[0-9a-f]+)?(?P<end>")''')


def tag(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def stamp(page):
    text = page.read_text(encoding='utf-8')
    missing = []

    def replace(m):
        target = (page.parent / m.group('path')).resolve()
        if not target.is_file():
            missing.append(m.group('path'))
            return m.group(0)
        return f"{m.group('attr')}{m.group('path')}?v={tag(target)}{m.group('end')}"

    new = LINK.sub(replace, text)
    if new != text:
        page.write_text(new, encoding='utf-8')
    return new != text, missing


def main():
    changed, problems = [], []
    for page in sorted(ROOT.rglob('*.html')):
        if '.git' in page.parts:
            continue
        did, missing = stamp(page)
        if did:
            changed.append(page.relative_to(ROOT))
        problems += [f'{page.relative_to(ROOT)}: {m}' for m in missing]
    for p in changed:
        print(f'stamped {p}')
    if not changed:
        print('all version tags already current')
    for p in problems:
        print(f'missing file, left as is: {p}', file=sys.stderr)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
