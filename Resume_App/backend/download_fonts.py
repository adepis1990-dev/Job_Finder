import urllib.request
import os

os.makedirs('fonts', exist_ok=True)

# These are direct raw GitHub links from a repo that bundles DejaVu TTFs
sources = {
    'DejaVuSans.ttf':
        'https://github.com/mathjax/MathJax/raw/master/fonts/HTML-CSS/TeX/otf/MathJax_Main-Regular.otf',
}

# Use the GNU FreeFont as fallback — full Unicode including Romanian, public domain
# FreeSans covers ș ț ă î â perfectly
gnu_base = 'https://ftp.gnu.org/gnu/freefont/'

# Actually use a reliable CDN mirror of DejaVu
urls = {
    'DejaVuSans.ttf':
        'https://cdn.jsdelivr.net/npm/@fontsource/dejavu-sans@latest/files/dejavu-sans-latin-ext-400-normal.woff2',
}

# Best approach: pull from a known npm package mirror that serves TTF
# Using the fonttools-compatible source at raw.github for pdf-lib usage
ttf_sources = {
    'DejaVuSans.ttf':      'https://cdn.rawgit.com/dejavu-fonts/dejavu-fonts/master/ttf/DejaVuSans.ttf',
    'DejaVuSans-Bold.ttf': 'https://cdn.rawgit.com/dejavu-fonts/dejavu-fonts/master/ttf/DejaVuSans-Bold.ttf',
}

# Use fonts from the Ubuntu font package mirror — most reliable
FONT_URLS = {
    'DejaVuSans.ttf':
        'https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-Regular.ttf',
    'DejaVuSans-Bold.ttf':
        'https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-Bold.ttf',
    'DejaVuSans-Oblique.ttf':
        'https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-Italic.ttf',
    'DejaVuSans-BoldOblique.ttf':
        'https://github.com/liberationfonts/liberation-fonts/raw/main/src/LiberationSans-BoldItalic.ttf',
}

for dest_name, url in FONT_URLS.items():
    dest = os.path.join('fonts', dest_name)
    print(f'Downloading {dest_name} ...')
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    with open(dest, 'wb') as f:
        f.write(data)
    print(f'  OK - {os.path.getsize(dest)} bytes')

print('Done.')
