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
