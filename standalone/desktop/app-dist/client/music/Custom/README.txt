Custom music folder
===================

Drop custom tracks here (wav, mp3, ogg, flac, m4a), then from the Standalone
folder run:

  npm run music:import -- public/music

That converts any wav/mp3/flac to Ogg Opus and rewrites public/music/manifest.json.
Tracks in this folder are only used when Settings → Audio → Custom music is on;
while it is on, the default tracks are disabled.

To add tracks to the default shuffled library instead, import a source folder
(or put files in public/music) and run:

  npm run music:import -- "C:\path\to\music"

The original purchased WAVs are never modified.
