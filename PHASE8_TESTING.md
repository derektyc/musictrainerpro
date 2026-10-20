# Phase 8 Testing Log

Last updated: 2026-10-20

## Phase 8.1 — Practice Requirements

Implemented:
- Assignment Wizard supports practice requirement count plus frequency: per day, per week, or total sessions.
- Advanced Manager exposes the same requirement controls instead of relying only on injected hidden UI.
- Requirement settings remain part of the existing assignment document and therefore use the current Firebase assignment sync path.
- A completed guided-practice session records a timestamp, practice time, highest speed, repetitions and playback source.
- Student Home prioritizes active assignments whose current requirement is still unmet.
- Student Home shows how many sessions remain for the current period.
- If every active assignment has met its current requirement, Today's Practice shows a completed state rather than immediately pushing another session.
- Student assignment cards mark current goals as met and keep optional Practice Again access.
- Practice Complete tells the student whether the current requirement is met or how many sessions remain.
- Assignment engine exposes normalized requirement status for later Phase 8 progress/dashboard work.
- Product UI label is now Phase 8.1 · Practice Requirements.

Automated/source-level checks passed:
- assignments.js parses without syntax errors.
- phase7-shell.js parses without syntax errors.
- auth.js parses without syntax errors.
- index.html contains no duplicate IDs.
- Practice requirement count and frequency controls exist in the static assignment form.
- Phase 8.1 product label is present in both initial and authenticated UI states.
- Student Home explicitly prioritizes assignments whose current requirement is unmet.
- Remaining-session calculation exists in both assignment-engine and shell requirement helpers.
- Goal-met assignments retain optional Practice Again behavior.
- Student Home includes the completed-current-goals state.
- Practice Complete includes requirement-met and remaining-session messaging.
- Phase 8.1 current-goal styles are present.
- Existing Firebase student progress upload continues to write the assignment progress object, which contains completed practice sessions.

Pending live/account/device checks:
- Teacher: create 1× per day assignment and confirm the Review step displays 1× per day.
- Student: complete one full guided session and confirm Today changes from 0/1 to 1/1.
- Student: return Home and confirm Today's Practice reports the current goal complete when no other requirement is outstanding.
- Student: use Practice Again after meeting the daily goal and confirm the extra session is recorded without making the goal display exceed its required count.
- Teacher: create 3× per day assignment; after one completion confirm the student sees 1/3 and 2 sessions remaining.
- Complete the second and third sessions and confirm remaining count changes 1 then 0.
- Teacher: create a weekly requirement and confirm completed sessions in the same Monday–Sunday week accumulate correctly.
- Teacher: create a total-session requirement and confirm it completes once the fixed session count is reached.
- Confirm the completed practice session syncs from the student account to the teacher account through Firebase.
- Confirm refreshing/reopening the app preserves the requirement and completed-session history.
- Confirm a new calendar day resets a daily requirement's current-period progress while retaining historical sessions.
- Confirm a new Monday resets a weekly requirement's current-period progress while retaining historical sessions.
- Check Student Home and Assignment cards at desktop, tablet and 360–430px phone widths.


## Automated runtime harness — 2026-10-20

Executed against the actual production source loaded from the main branch.

Assignment engine checks passed:
- 3× per day starts at 0/3 with 3 remaining.
- First completed guided session becomes 1/3 with 2 remaining.
- Replaying the same session ID does not double-count it.
- Second completed session becomes 2/3 with 1 remaining.
- Third completed session becomes 3/3 with the requirement met.
- Completed sessions persist practice time, highest speed, repetition count and source.
- Weekly counting ignores sessions from the previous Monday–Sunday week.
- Total-session counting includes historical sessions.
- A 2-session total goal becomes met exactly at 2/2.
- Daily rollover ignores yesterday's session while retaining it in history.

Modern Phase 8.1 shell checks passed:
- Daily, weekly and total requirement calculations match the assignment engine.
- Assignment Wizard frequency labels render correctly for daily, weekly and total goals.
- Student assignment sorting prioritizes an unmet current requirement ahead of a currently-met recurring goal, while completed assignments remain behind active work.

Practice engine completion check passed:
- The real Practice engine emits the final rep event and one practice-complete event.
- Completion carries the same session ID and song ID.
- Completion payload contains the assignment settings, target speed, total repetitions and elapsed time.
- completed becomes true and the practice session closes after the target-speed repetition requirement is reached.

Firebase/cloud sync compatibility check passed:
- Student progress upload writes only progress and updatedAt for the student's own assignment.
- Practice requirement/settings fields are not written by a student progress upload, matching the Firestore rule that limits student assignment updates to progress and updatedAt.

Repository regression sweep passed:
- app.js, practice.js, assignments.js, auth.js, song-cloud.js, phase7-shell.js and cloud-sync.js all parse successfully.
- Every local CSS/JS asset referenced by index.html exists on the main branch.
- styles.css, practice.css, assignments.css, auth.css and phase7-shell.css all have balanced braces.
- index.html has no duplicate element IDs.

Result:
- No Phase 8.1 logic regression was found in the automated/runtime-isolated tests.

Still requires a genuine browser/account environment:
- Real Firebase Authentication sign-in and Firestore network round-trip between separate teacher/student accounts.
- Real Google Drive OAuth/material download flow.
- Visual rendering/touch testing on actual desktop/tablet/phone browsers.
- A real next-day / next-Monday wall-clock rollover rather than simulated timestamps.


## Percussion MusicXML compatibility hotfix — 2026-10-20

Issue reproduced conceptually from a MuseScore drum export:
- Hi-hat/cymbal notes explicitly carry an X notehead.
- Normal drum hits such as kick/snare/toms may omit the notehead because MusicXML defines normal as the default.
- alphaTab can preserve the explicit X heads while leaving the implicit normal percussion heads without a visible symbol, producing stems with missing kick/snare noteheads.

Fix:
- Before loading .musicxml/.xml into alphaTab, unpitched notes with no explicit notehead receive an explicit normal notehead.
- Existing explicit noteheads, including X hi-hats/cymbals, are preserved unchanged.
- .mxl files are unpacked in-memory, normalized when needed, and passed to alphaTab as MusicXML.
- The source Library file is not modified.
- Browser cache version for app.js was bumped so existing deployments fetch the hotfix.

Automated/browser-DOM test passed:
- A MuseScore-style sample containing one explicit X hi-hat, one implicit-normal kick and one implicit-normal snare was run through the compatibility normalizer in a real Chromium DOM.
- Exactly two noteheads were restored.
- Final noteheads were x, normal, normal.
- Existing X notehead remained unchanged.

Regression checks passed:
- app.js, practice.js, assignments.js, auth.js, song-cloud.js and phase7-shell.js parse successfully.
- index.html references the new app.js cache version.


## MuseScore system-break preservation hotfix — 2026-10-20

Behavior:
- MusicXML <print new-system="yes"> and <print new-page="yes"> markers are detected before alphaTab loads the score.
- Forced break indices are propagated to every rendered track so multi-track scores keep the same minimum system boundaries.
- Responsive alphaTab wrapping remains enabled; narrow screens may wrap earlier, but a forced MuseScore break cannot be collapsed away.
- Imported break state is cleared after each score load so one song cannot leak its layout into another.

Automated/source checks passed:
- A simulated 8-bar MuseScore score with new-system="yes" on measure 5 produced the expected break index [4], meaning bars 1–4 stay on the first system.
- Duplicate break markers across multiple parts are de-duplicated.
- new-page="yes" is treated as a forced system boundary too.
- app.js and the rest of the main JavaScript bundle parse successfully.
- index.html references the refreshed app.js cache version.


## MuseScore section/model-layout fallback — 2026-10-20

Observed live behavior:
- The score rendered 3 bars on the first system and continued bar 5 beside bar 4 even though MuseScore visually showed A = bars 1–4 and B = bars 5–8.
- This indicates the export did not provide a usable hard system break for that layout, so alphaTab remained in automatic wrapping mode.

Fix:
- MusicXML still uses explicit new-system/new-page markers when present.
- If no explicit system break exists, rehearsal/section markers are used as musical layout boundaries.
- The viewer builds alphaTab model-layout counts from those boundaries and switches the MusicXML score to UseModelLayout before the initial render.
- Example: section A on bar 1 and section B on bar 5 in an 8-bar score becomes systemsLayout [4,4].
- Remaining measures continue using the first section length as the default model row size.
- Non-MusicXML scores reset back to Automatic layout.
- MusicXML detection now also sniffs score XML content instead of relying only on the cached filename extension.

Automated/source checks passed:
- An 8-bar score with A on bar 1 and B on bar 5 resolves to [4,4].
- An explicit break before bar 5 also resolves to [4,4].
- A 12-bar A/B score resolves to [4,4,4].
- A score with no break or section markers stays in automatic layout.
- All main JavaScript files parse successfully.
- index.html points to the refreshed layout2 app.js cache version.


## Backing-track count-in sync + exact interactive-title hotfix — 2026-10-20

Backing sync changes:
- Auto Sync now estimates a score-start offset instead of assuming bar 1 begins at audio time 0.
- High-confidence duration matching compares backing-track duration with alphaTab playback duration and snaps plausible gaps to whole score beats.
- A transient-click analyser provides a fallback/confirmation path for audible count-in clicks near the start of the file.
- Auto Sync stores bar 1 at the detected audio offset and the final score point at the end of the backing track.
- The final auto-sync point uses the final playback occurrence of the last master bar, improving repeat-aware scores.
- External MP3/WAV playback no longer writes raw audio milliseconds directly into alphaTab timePosition.
- Saved sync points are converted into an audio-time ↔ score-time interpolation map.
- During a pre-roll/count-in, the score cursor remains at the beginning until the first score sync point is reached.
- Backing section loops now convert score bar times back to backing-audio times before seeking.

Runtime-isolated checks passed:
- A 64-second backing track against a 60-second score at 60 BPM detects a 4-beat / 4.000-second offset.
- Equal score/audio duration produces no count-in offset.
- Duration and transient-click candidates that agree are combined into a higher-confidence result.
- With sync points audio 4s → score 0s and audio 64s → score 60s:
  - audio 2s maps to score 0s;
  - audio 4s maps to score 0s;
  - audio 34s maps to score 30s;
  - audio 64s maps to score 60s;
  - inverse score mapping returns 4s, 34s and 64s respectively.
- A repeated playback lookup correctly reports the last occurrence index for the last repeated bar.
- All main JavaScript files parse successfully after the change.

Interactive title behavior:
- Auto-created song titles now copy the interactive filename exactly, removing only the final file extension.
- Case, punctuation, underscores, spaces and parenthetical text are preserved.
- Add Song uses the same exact filename rule and still permits a manual title override.

Title tests passed:
- RGP G0 Yellow (bt click) with vocals.musicxml → RGP G0 Yellow (bt click) with vocals
- Debut_Drum Grooves - Part 1.gp → Debut_Drum Grooves - Part 1
- My.Song.Name.gpx → My.Song.Name

Live browser check still recommended:
- Open a real backing track with an audible count-in, run Auto Sync, and confirm the reported offset matches the first musical downbeat.
- Confirm the cursor waits during the count-in, starts moving on bar 1 at the detected downbeat, follows repeats correctly, and loop seeking remains aligned.


## Synced-backing cursor-driver hotfix — 2026-10-20

Observed issue:
- MP3/WAV playback worked in Synced Backing mode but the alphaTab cursor stayed still.
- alphaTab only emits cursor-position updates while its own main player is in Playing state; seeking timePosition while the synth is stopped does not drive the rendered cursor.

Fix:
- Synced Backing now starts alphaTab's player as a muted cursor driver.
- alphaTab master volume is forced to 0 while the backing track is the audible source.
- The existing audio-to-score sync map continues to seek alphaTab every 50 ms.
- The player-state handler no longer pauses the MP3 when alphaTab is playing specifically for Synced Backing.
- Pausing/ending the MP3 pauses the muted cursor driver.
- Switching back to Synth restores the previous alphaTab master volume.

Regression checks passed:
- app.js parses successfully.
- All main JavaScript files parse successfully.
- Synced-backing play path starts both the cursor driver and sync timer.
- Synth mode restores alphaTab volume.
- index.html references app.js?v=20261020-sync2.
