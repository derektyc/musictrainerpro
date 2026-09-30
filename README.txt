DT Music Trainer – Interactive Score Prototype v1.2

FIX IN v1.2
- Local score uploads are now passed to alphaTab as Uint8Array bytes.
- Improved MuseScore guidance and upload error message.
- Fixed the error alert line breaks.
- Keeps the v1.1 visible playback cursor fix.

MUSESCORE
MuseScore native .mscz files are not loaded directly by this prototype.
In MuseScore:
File > Export > MusicXML
Then use either:
- .musicxml
- .mxl

RETEST
1. Replace your current GitHub index.html with this index.html.
2. Hard refresh with Ctrl+F5.
3. Export a MuseScore file as MusicXML (.musicxml preferred for the first test).
4. Upload it.
5. Confirm the score renders.
6. Test play/cursor, speed, tracks and loop.

No Google Drive or Google login is included.
