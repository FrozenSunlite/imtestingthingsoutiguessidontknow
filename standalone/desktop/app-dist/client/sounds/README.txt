Sound effects folder
===================

Drop short effect files here (wav, mp3, ogg, flac, m4a) and run:

  npm run sounds:index

That rewrites manifest.json with one entry per file:

  { "name": "click", "file": "/sounds/click.ogg" }

The app reads the manifest at runtime. The effect name "click" is wired to
buttons, links, tabs and checkboxes automatically; other names can be played
from code with:

  import { playSfx } from "@/lib/audio";
  playSfx("dice");

Effects are converted to the format you save them in; Ogg Opus or MP3 keeps
the APK small.
