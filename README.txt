DT Music Trainer Pro — Phase 3

Repository scope
- This build lives only in derektyc/musictrainerpro.
- The original derektyc/musictrainer repository is not modified.

PHASE 3 — SYNCED BACKING TRACKS
Phase 3 adds real MP3/WAV playback while the interactive score cursor follows the audio.

New sync workflow:
1. Add an interactive score and MP3/WAV to the same song.
2. Open Interactive.
3. Use Auto Sync Whole Song for a quick start/end alignment.
4. Choose Synced Backing.
5. Press the main Play button. The real audio drives the notation cursor.
6. If the backing track has an intro or gradually drifts:
   - seek the backing audio to the exact point,
   - enter the matching bar number,
   - press Mark Current Audio at Bar Start.
   Additional sync points refine the alignment.

Sync points are stored per song and included in Save Library ZIP backups.

PHASE 3 PLAYER
- Synth mode remains available.
- Synced Backing mode uses the real MP3/WAV as the playback clock.
- Moving cursor follows the backing track.
- Off-screen score scrolling remains enabled.
- Seeking in the audio player updates the score position.
- Speed control changes the real backing-track playback speed.
- Bar loops work with synced backing tracks.
- Track switching and zoom remain available.
- Metronome/count-in remain for Synth mode; they are disabled in Synced Backing mode.

PHASE 2 FEATURES RETAINED
- Local song library using IndexedDB.
- One song can contain:
  - PDF score
  - Interactive Guitar Pro / MusicXML score
  - MP3 or WAV backing track
- Automatic grouping by matching song title.
- Manual Create Song + Attach Files.
- PDF opening.
- Local Save Library ZIP / Load Library ZIP.
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

SUPPORTED AUDIO
- MP3
- WAV

PHASE 3 TEST
Use the DT Test Groove pack created for this project:
1. Add DT Test Groove.musicxml, DT Test Groove.pdf and DT Test Groove.wav.
2. Open Interactive.
3. Click Synced Backing.
   - If no points exist yet, the app creates automatic start/end sync points.
4. Press Play.
5. Confirm the cursor follows the WAV.
6. Try 75% and 125% speed.
7. Loop bars 5–8.
8. Seek in the audio controls and confirm the cursor jumps with it.
9. Save Library ZIP and restore it to confirm sync points persist.

For real commercial recordings, Auto Sync is the starting point. Add manual bar markers when the recording has an intro, tempo changes, rubato, or timing differences from the score.
