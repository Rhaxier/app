# App icons and launch screens

The Home Screen icon (iPhone, iPad, Android) and the iPhone launch screens, made from
one picture.

- `app-icon-1024.png`: the picture everything is made from. 1024 × 1024, a full square
  (no rounded corners: phones round them), artwork inside the middle 80% (Android cuts
  icons into circles and other shapes).
- `app-icon.svg`: the source of the current placeholder icon (the favicon's mark on the
  accent blue). Not needed if you replace the PNG with your own picture.
- `make_icons.py`: makes `public/icons/` (the icons and launch screens) and the launch
  screens' tags in `index.html`.

```bash
python tools/app-icons/make_icons.py    # from the repo root; needs Pillow (pip install pillow)
```

Then commit the changed files in `public/icons/` and `index.html`. See "Install on iPhone
and iPad" in the README and Q57 in `docs/OPEN_QUESTIONS.md`.
