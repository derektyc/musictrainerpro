DT Music Trainer Pro — Phase 2

Repository scope
- This build lives only in derektyc/musictrainerpro.
- The original derektyc/musictrainer repository is not modified.

PHASE 2 FEATURES
- Local song library using IndexedDB.
- One song can contain:
  - PDF score
  - Interactive Guitar Pro / MusicXML score
  - MP3 or WAV backing track
- Files with matching song titles are grouped automatically.
- You can also create a song manually and attach files directly to it.
- Interactive score opens inside the main app.
- alphaTab playback:
  - moving cursor
  - off-screen scrolling (score stays still until playback needs the next section)
  - speed control
  - track switching
  - count-in
  - metronome
  - bar looping
  - zoom
- PDF opens from the same song.
- Backing track plays from the same song.
- Save Library exports the whole Pro library as a ZIP.
- Load Library restores that ZIP on another browser/device.
- No Google Drive or Google login.

SUPPORTED INTERACTIVE SCORE FILES
- .gp
- .gpx
- .gp3 / .gp4 / .gp5 / .gp6 / .gp7 / .gp8
- .musicxml
- .mxl
- .xml

MuseScore native .mscz files are not opened directly.
Export from MuseScore as MusicXML first.

SUPPORTED OTHER FILES
- PDF
- MP3
- WAV

HOW TO TEST PHASE 2
1. Open https://derektyc.github.io/musictrainerpro/
2. Add your Chengdu .musicxml.
3. Add a Chengdu PDF if you have one.
4. Add a Chengdu MP3/WAV backing track if you have one.
5. Confirm they appear under the same song card.
6. Open Interactive and test playback/cursor/scroll/loop/tracks/speed.
7. Open PDF.
8. Play Backing.
9. Save Library ZIP, then Load Library ZIP to confirm the files restore.

NEXT PHASE
- Real backing-track synchronization with the interactive score.
- Practice Mode and assignments after sync is stable.
