DT Music Trainer Pro — Phase 4

Repository scope
- This build lives only in derektyc/musictrainerpro.
- The original derektyc/musictrainer repository is not modified.

PHASE 4 — PRACTICE MODE
Phase 4 adds guided section practice on top of the working interactive-score and synced-backing player.

PRACTICE SETTINGS
- Start bar / end bar
- Starting speed
- Target speed
- Speed increment
- Number of successful reps required before increasing speed
- Optional count-in

PRACTICE FLOW
1. Select a song and Open Interactive.
2. Choose Synth or Synced Backing.
3. Set the practice bars and speed plan.
4. Press Start Practice.
5. The selected section is looped automatically.
6. After a clean run, press Successful Rep.
7. After the required number of reps, the app automatically moves to the next speed step.
8. Retry Section restarts the same section without counting a success.
9. Reset Progress returns the session to the starting speed.
10. The session is complete after the required reps are cleared at the target speed.

PRACTICE MODE FEATURES
- Works with Synth playback.
- Works with Synced Backing playback.
- Uses the existing bar-loop engine.
- Uses the existing 25–150% speed controls.
- Synth mode uses alphaTab count-in.
- Synced Backing mode uses a visual/audio 4-count before a run or new speed step.
- Per-song practice settings are remembered locally in IndexedDB.
- Progress panel shows current speed, reps and target progression.
- Successful Rep is intentionally manual: the app does not pretend to know whether the student played a run correctly yet. Performance listening/scoring can be added in a later phase.

PHASE 3 RETAINED
- Real MP3/WAV backing track can drive the notation cursor.
- Automatic whole-song sync plus manual bar sync points.
- Seeking updates the score position.
- Synced bar looping and speed changes.
- Sync points are included in Library ZIP backups.

PHASE 2 RETAINED
- Local song library using IndexedDB.
- One song can contain PDF + interactive score + MP3/WAV.
- Automatic grouping by matching title.
- Save Library ZIP / Load Library ZIP.
- No Google Drive or Google login.

SUPPORTED INTERACTIVE SCORE FILES
- .gp
- .gpx
- .gp3 / .gp4 / .gp5 / .gp6 / .gp7 / .gp8
- .musicxml
- .mxl
- .xml

MuseScore native .mscz files are not opened directly. Export them as MusicXML first.

PHASE 4 TEST
Use DT Test Groove:
1. Open DT Test Groove Interactive.
2. Start in Synth mode.
3. Practice bars 5–8 from 60% to 80%, +10%, 2 successful reps per step.
4. Confirm speed moves 60 → 70 → 80 after the selected reps.
5. Confirm Retry does not add a successful rep.
6. Reset Progress and confirm it returns to 60%.
7. Switch to Synced Backing and repeat the same test.
8. Confirm the backing track follows the selected loop and changes playback speed.
9. Change the practice settings, select another song, then return and confirm the previous settings are remembered on this device.

NEXT DIRECTION
Once Practice Mode is stable, the next logical layer is assignments and student progress: teacher-selected song/section/speed targets, completion history, practice minutes and student/parent views.
