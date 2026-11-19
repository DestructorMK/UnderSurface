# Undersurface prototype 0.1

Source for the single-file build. Edit these files, then run `python3 build.py` → `dist/index.html`.

- `sim.js`      species, biomes, deterministic population model (1 step = 1 simulated day)
- `art.js`      flat-vector organisms, cutaway layers, sample surfaces
- `app.js`      camera, surface classifier, x-ray lens, measure/act/time, mystery, research log
- `style.css`   design tokens (Helvetica, ink #111, paper #F7F7F5, hairlines)
- `template.html` markup; build.py inlines everything into one file

URL options: `?speed=60` (time runs 60x faster), `?dev` (shows "skip 1 day" on home).
Camera needs HTTPS (or localhost). Research log: Home → Research log → Download JSON.
