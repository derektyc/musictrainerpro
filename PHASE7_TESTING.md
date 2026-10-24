# Phase 7 Testing Log

Last updated: 2026-10-20

This file tracks checks that could not be completed automatically from the repository and should be verified later in the live authenticated app.

## Phase 7.4 — Student Profiles

Pending live checks:
- Open a student profile from the Students page and confirm the correct Firebase/cloud data is shown.
- Open a student profile from Dashboard > Needs Attention and confirm the correct student opens.
- Open a student profile from Dashboard > Recent Practice and confirm the correct student opens.
- Save a teacher-only note, leave the profile, reopen it, and confirm the note persists.
- Repeat the teacher-note persistence check after a browser refresh or on another signed-in teacher device.
- Confirm students cannot see teacher-only notes in their own account.
- Use + New Assignment from a student profile and confirm that student is preselected.
- Use Manage Assignments from a student profile and confirm the correct student is selected in the compatibility manager.
- Use Back to Students and confirm navigation returns cleanly to the student directory.

Automated checks already passed:
- Profile session aggregation.
- Newest-first recent-practice ordering.
- Practice streak calculation.
- Latest-practice detection.
- Weekly boundary calculation.
- Assignment status regression cases.
- Main JavaScript syntax checks.
- CSS balance and responsive profile breakpoints.
- Student navigation remains student-only.
- Teacher notes are stored on the teacher user document rather than student-readable records.
- Phase 7.4 regression checks were rerun after the Phase 7.5 changes and still pass.

## Phase 7.5 — Assignment Wizard

Automated checks already passed:
- Four-step Student > Song > Practice > Review wizard is present.
- General wizard does not silently preselect a student.
- Student Profile > + New Assignment can preselect that student and begin at Song.
- Songs without an interactive score are blocked from selection.
- Synced Backing is disabled when the selected song has no backing track.
- Practice values are normalized and clamped before saving.
- Invalid student / empty song creation is rejected.
- Count-in preference is preserved.
- Teacher note length is capped safely.
- Assignment creation saves locally and dispatches the existing dtmtp:assignment-created event.
- Existing Google Drive publish listener still receives assignment-created events.
- Existing Firebase teacher sync and student progress sync remain intact.
- Teacher Assignments no longer automatically opens the old modal.
- Student assignment page still hides teacher-only creation controls.
- CSS and JavaScript syntax/regression checks pass.
- Phase 7.3 / 7.4 assignment status and student-profile calculations still pass.

Bugs found and fixed during Phase 7.5 testing:
- Removed accidental student preselection in the general New Assignment flow.
- Fixed the song-loading state being replaced too early while the library was still loading.
- Added a recovery path when there are no students yet.
- Added a Song Library shortcut when no songs with an interactive score are assignable.

Pending live checks after deployment:
- Dashboard > + New Assignment opens the new wizard.
- Assignments > + New Assignment opens the new wizard.
- Student Profile > + New Assignment opens at the Song step with the correct student preselected.
- General wizard does not silently preselect a student.
- Songs without an interactive score cannot be selected.
- Song material badges correctly reflect Interactive / PDF / Backing availability.
- Back/Continue preserves entered practice settings.
- Review screen matches the entered student, song, bars, speed progression, frequency, due date, source, count-in and note.
- Creating the assignment makes it appear in the teacher assignment list and student profile.
- The student receives the assignment after Firebase sync.
- The assigned song is uploaded/published through the existing Google Drive material flow.
- A student on a fresh browser can open the assignment and download/cache its materials.
- Advanced Manager still opens the existing compatibility manager for duplicate/delete actions.
- Mobile/tablet wizard layout is usable and no controls overflow.


## Phase 7.6 — Song Library

Automated checks already passed:
- Main JavaScript files parse without syntax errors.
- Phase 7.6 CSS braces and responsive breakpoints are balanced.
- The legacy library controls remain mounted but hidden so the existing engine continues working.
- The new catalogue supports All / Interactive / PDF / Backing / Assigned / Incomplete filters.
- Search logic correctly filters by song title.
- Bulk file grouping still groups matching Guitar Pro / PDF / backing-track filenames into one song.
- Bulk file import now returns an added/skipped/song-count summary for the new UI.
- Add Song accepts optional Interactive / PDF / MP3-WAV assets and validates file types.
- Rename and asset replacement use the existing IndexedDB song records.
- Replacing an interactive score or backing track resets sync points as before.
- Assigned-song deletion is blocked in the Phase 7.6 UI instead of silently breaking assignment references.
- Library > Assign passes the selected song into the Phase 7.5 assignment wizard.
- The Library entry flow asks for a student first, then skips the already-completed Song step.
- Existing assignment-created and library-changed Google Drive publishing hooks remain intact.
- Existing teacher Firebase sync and student progress sync remain intact.
- PDF preview now opens directly from the loaded Blob to reduce popup-blocker problems.
- Backing-track preview uses an in-page audio player.
- Save ZIP / Load ZIP backup controls remain available.
- The earlier Phase 7.3 assignment status, Phase 7.4 profile calculations, and Phase 7.5 assignment API regression checks still pass.

Bugs found and fixed during Phase 7.6 testing:
- Fixed the mobile song-detail view losing its state after a library refresh.
- Fixed mobile material action buttons creating an unintended third grid column on small phones.
- Debounced Library search and restored input focus after re-rendering.
- Stopped/revoked backing-track preview audio when leaving the Library.
- Made Library cloud wording reflect only what is actually known: Drive connected vs reconnect required, rather than claiming an upload is definitely complete.
- Added a warning when an assignment references a song that is missing from the local Library.
- Removed stale Phase 3 wording from the underlying library/player status text.

Pending live checks:
- Add a new song through + Add Song and confirm it survives a browser refresh.
- Add a song with Interactive + PDF + Backing and verify all three appear correctly in Song Details.
- Drop three matching files such as Song.gp / Song.pdf / Song backing track.mp3 and confirm they group into one song.
- Test each Library filter and title search with the real local catalogue.
- Open an interactive score from Song Details and confirm it routes to Practice and loads the correct song.
- Preview a PDF and confirm browser popup handling is acceptable.
- Play a backing-track preview and confirm it stops cleanly when leaving Library.
- Replace Interactive / PDF / Backing assets and confirm the correct files persist after refresh.
- For an assigned song, replace a material and confirm the existing Google Drive sync republishes it.
- Library > Assign should open the wizard with the song already selected, then ask for a student.
- Complete that assignment and confirm the student receives it after Firebase sync.
- Confirm assigned songs cannot be deleted from the new Library UI.
- Confirm an unassigned song can be deleted and stays deleted after refresh.
- Open assigned-student rows in Song Details and confirm each opens the correct student profile.
- Save ZIP and Load ZIP from the new Library toolbar.
- Test the catalogue/detail layout on tablet and phone, including the mobile Back to Library button.
- Confirm Google Drive connected/reconnect wording updates after changing Drive connection state.


## Phase 7.7 — Practice Player

Automated checks already passed:
- Existing alphaTab / practice engine remains mounted; Phase 7.7 is a UI layer around the proven controls rather than a replacement engine.
- The old viewer header and old transport controls remain in the DOM for compatibility but are visually hidden inside the new player.
- New Play/Pause control proxies the existing playBtn.
- New Restart control uses Practice Retry during a guided session and normal stop/replay outside guided practice.
- New Start Practice / Stop Practice button proxies the existing practice engine controls.
- New Loop control proxies the existing loop engine and is locked while Guided Practice owns the loop.
- New Speed slider proxies the existing player speed and is locked while Guided Practice owns automatic speed progression.
- New Zoom slider proxies the existing alphaTab zoom control.
- Synth / Backing source buttons proxy the existing source controls and are locked during an active guided session.
- PDF access proxies the existing PDF action.
- Student practice keeps advanced teacher controls hidden.
- Teacher Advanced Tools are collapsed by default and open only on request.
- Teacher Advanced Tools use an overlay drawer on narrow screens instead of disappearing.
- Guided Practice progress mirrors the existing practice progress bar.
- Practice state is read from DTMusicTrainerPractice.getState when available instead of relying only on button state.
- Existing Phase 7.2 completion/progress events remain intact.
- The top-left, non-blurred count-in remains intact.
- Phase 7.4 profiles, Phase 7.5 assignment wizard and Phase 7.6 Library remain present.
- Main JavaScript files and Phase 7 CSS parse/balance checks pass.

Bugs found and fixed during Phase 7.7 testing:
- Anchored the teacher mobile Advanced Tools drawer to the Practice page so it does not position against the wrong viewport.
- Kept PDF access visible on small screens instead of hiding an important student action.
- Switched active-session detection to DTMusicTrainerPractice.getState when available instead of inferring only from disabled buttons.
- Forced Advanced Tools closed whenever a student role is applied, even if a teacher previously left the drawer open.

Pending live checks:
- Open an assignment as a student and confirm the correct song title, bars and speed target appear in the new score header.
- Confirm Start Practice changes to Stop Practice while a guided session is active and changes back afterward.
- During guided practice, confirm Speed, Loop and Synth/Backing are visually locked while automatic progression is running.
- Confirm Restart Current Speed resets the rep count and restarts the current guided speed correctly.
- Confirm Play/Pause can pause and resume a guided repetition without corrupting rep counting.
- Confirm automatic reps and speed increases still occur normally through a full assignment.
- Confirm the thin guided-progress line advances correctly and reaches completion.
- Confirm Synth and Synced Backing both work before starting practice.
- Confirm backing-track assignments still follow saved sync points in the new player.
- Confirm PDF opens from the new Practice header.
- Confirm teacher Library > Open Interactive lands in the new Practice player with the correct score.
- Confirm Advanced Tools opens/closes correctly on teacher desktop.
- Confirm Advanced Tools drawer opens/closes correctly on teacher phone/tablet.
- Confirm students cannot expose Advanced Tools.
- Confirm the score has materially more usable vertical space than before and no controls cover notation.
- Confirm count-in still appears at the top-left of the score with no background blur.
- Confirm tablet/phone controls remain tappable and the score remains scrollable while the bottom navigation is visible.


## Phase 7.8 — Final Polish

Automated/source-level checks already passed:
- Main JavaScript files parse without syntax errors.
- All application CSS files have balanced braces.
- Static HTML contains no duplicate IDs.
- Every DOM dependency referenced by the existing Practice engine is still present.
- Existing Phase 7.3 teacher/profile date and practice calculations still pass.
- Existing Phase 7.5 assignment status and assignment-creation regression checks still pass.
- Existing Phase 7.6 matching-file grouping still groups Interactive + PDF + Backing files into one song.
- Existing Phase 7.7 Practice public state contract and score-first shell remain present.
- Firebase teacher upload and student progress upload hooks remain intact.
- Google Drive song publishing hooks remain intact.
- The count-in remains top-left and explicitly has no background blur.
- Tablet/mobile navigation switches to bottom navigation at 900px and below.
- Student mobile navigation remains four columns; teacher navigation remains five columns.
- Dynamic viewport units and top/bottom/left/right safe-area insets are present.
- Mobile forms use 16px text sizing to avoid browser auto-zoom while editing.
- Small-phone and short-landscape breakpoints are present.
- Long titles/copy have overflow wrapping/min-width safeguards.
- Keyboard focus-visible styling and reduced-motion handling are present.
- Navigation buttons expose aria-label and aria-current state.
- Primary navigation and main-content landmarks are exposed to assistive technology.
- Add Song and Practice Complete overlays have dialog semantics.
- Escape closes transient Add Song / completion / Advanced Tools UI.
- Changing routes closes the teacher Advanced Tools drawer and resets the newly opened page scroll position.
- Auth dialogs respect mobile safe areas and the sign-in/setup card remains scrollable on short screens.
- Old Phase 6 / Phase 7.3 / Phase 7.5 / Phase 7.7 user-facing copy was removed from the active UI.

Bugs / polish issues found and fixed during Phase 7.8:
- Teacher mobile topbar could theoretically overflow when both cloud status and a long account name were visible; widths are now constrained and the control group owns the available row.
- The mobile sign-in/setup card had a max height without an explicit scroll fallback; it is now scrollable.
- The Progress heading still described itself as a future Phase 7.3 feature; it now describes the actual finished progress view.
- The assignment wizard still displayed a Phase 7.5 development label; it now uses a normal product-facing “Assignment wizard” label.
- Leaving Practice could preserve an open teacher Advanced Tools state; navigation now closes it.
- Page scroll positions could carry over when changing main sections; a genuine route change now starts the destination page at the top.
- Dialogs had Escape handling missing from the new shell layer; Add Song, Practice Complete and Advanced Tools can now be dismissed with Escape where applicable.

Pending live/device checks:
- Test teacher layout at approximately 1440px, 1024px, 900px, 834px, 768px, 430px, 390px and 360px widths.
- Test student layout at the same phone/tablet widths and confirm the four-item bottom navigation remains evenly spaced.
- On a real iPhone/iPad or equivalent mobile browser, confirm bottom navigation clears the home indicator/safe area.
- Rotate a phone/tablet between portrait and landscape and confirm the current page remains usable without clipped navigation.
- Confirm no browser auto-zoom occurs when focusing Library search, assignment fields, teacher notes or login fields on mobile.
- Confirm long student names, song titles and account emails do not push cards/topbar controls off-screen.
- Confirm teacher Cloud Account + cloud status fit on a narrow phone topbar.
- Keyboard-test desktop navigation and forms using Tab / Shift+Tab; confirm focus rings are easy to follow.
- Press Escape with Add Song open and confirm it closes.
- Press Escape with the Practice Complete dialog open and confirm it closes.
- Press Escape with teacher Advanced Tools open and confirm the drawer closes.
- Confirm navigating away from Practice and back does not reopen Advanced Tools unexpectedly.
- Confirm main pages start at the top when switching sections after previously scrolling.
- Confirm sign-in / teacher setup remains scrollable on a short phone screen with the software keyboard open.
- Confirm reduced-motion OS/browser preference does not leave essential UI state unclear.
- Complete the still-pending authenticated Firebase / Drive / audio / student-device checks recorded under Phases 7.4–7.7.


## Extended automated regression — 2026-10-16

Additional tests completed after the Phase 7.8 build:
- Teacher navigation creates exactly five desktop and five mobile routes; student navigation creates exactly four desktop and four mobile routes.
- Role route guards reject teacher-only routes for students and student-only Home for teachers.
- Navigation updates aria-current correctly, clears it from inactive items, closes the Practice Advanced Tools drawer, and resets page/stage scroll on route changes.
- Teacher student-profile routing selects the requested student, keeps Students highlighted, activates the profile page, rejects invalid student IDs, and cannot be invoked by a student role.
- Teacher-only notes were simulated against the Firebase document API: save, trim, preserve other students' notes, reload, unlock the editor after load, and reject student-role saves.
- Assignment Wizard entry-state tests passed for General, Student Profile, Library-selected song, Student+Song preselection, and rejection of non-interactive preselected songs.
- Library cloud-state tests passed for Local, Assigned + Drive connected, and Assigned + reconnect required.
- Library > Open Interactive was simulated end-to-end through selectSong -> Practice route -> openInteractive with the same song ID.
- Library delete primitive was tested for active-score cleanup, backing-preview cleanup, selected-song clearing, cache refresh, and harmless missing-song deletion. Assigned-song deletion remains separately guarded by the Phase 7.6 UI.
- Practice chrome was simulated for inactive and active Guided Practice states. Song/bars/speed metadata, Start/Stop button text, position, progress, source, Play/Pause label, student-only hiding, and guided locking of Speed/Loop/Source all passed.
- Practice progression engine was simulated from 60% -> 70% -> 80% with 2 successful reps per step. It completed after the target-speed reps, emitted the expected rep/speed-change/complete events, and ignored duplicate rep triggers while transitioning.
- Restart Current Speed was simulated: step reps reset to zero while total reps/current speed are preserved, the restart-step event fires, and completed sessions ignore restart attempts.
- Existing Phase 7.3/7.4 profile calculations, Phase 7.5 assignment creation/status, Phase 7.6 file grouping, Phase 7.7 Practice public state contract, Firebase sync hooks, Google Drive publishing hooks, CSS balance, JavaScript syntax, HTML ID uniqueness and Practice DOM dependencies remain passing.

Still requires a real browser/account/device:
- Firebase authentication and cross-device persistence.
- Actual Google Drive OAuth/upload/download behaviour.
- Browser audio playback and backing-track sync timing.
- Real PDF popup behaviour.
- IndexedDB persistence across a real browser refresh.
- Real visual rendering at the recorded desktop/tablet/phone widths.
- iOS/iPadOS safe areas, software keyboard and browser auto-zoom.
- Real keyboard/tab order and focus-ring appearance.
- GitHub Pages deployment/runtime verification from the public URL.


## Cloud Library + Readability Update — 2026-10-16

Implemented:
- Google Drive is now the teacher Library master storage.
- Drive structure adds DT Music Trainer Pro / Library alongside the existing Assigned Materials folder.
- Each synced song receives its own private Drive folder.
- Firestore song metadata acts as the cloud catalogue/index, so a teacher can see the Library on another device without downloading every file.
- IndexedDB remains the local cache.
- Selecting a song row does not download its files.
- Opening Interactive, PDF or Backing downloads/caches only that requested asset.
- Existing local songs automatically migrate to the Drive master when Drive is connected.
- Legacy songs that previously existed only in Assigned Materials have a migration path into the private Drive Library.
- Assignment publishing uses Google Drive file-copy from the private master into Assigned Materials, so assigning a cloud song does not require caching all teacher files first.
- Assigned Materials remains separate and public-link-readable for students; teacher master files are not deliberately shared.
- Assignment Wizard song selection now reads the cloud catalogue.
- Library Rename / Replace / Delete actions operate against the cloud master while maintaining local cache compatibility.
- Save ZIP explicitly hydrates uncached cloud files to create a complete backup; Load ZIP is presented as Import ZIP and restored songs sync back to Drive.
- Added Sync Drive control to the teacher Library.
- Platform typography received a comfortable readability pass, increasing common 7–10px labels/copy into approximately 10–14px ranges while retaining compact layouts.
- Google Drive access tokens now attempt silent renewal while the same browser session remains active, reducing repeated reconnect prompts when the short-lived access token expires. If Google requires fresh interaction, the UI falls back to Reconnect Google Drive instead of pretending the session is usable.

Automated checks completed:
- Cloud catalogue merges Firestore metadata with local IndexedDB cache without downloading asset bytes.
- Matching cached assets reuse their local Blob.
- Uncached cloud assets remain metadata-only until opened.
- ensureLibraryAsset downloads only the requested kind and reuses it on the next open.
- Private uncached master assets require the teacher Drive connection.
- Master uploads target the per-song Library folder and are not deliberately shared publicly.
- Existing uncached master asset metadata is preserved when another asset changes locally.
- Cloud-only assignment publishing copies all master assets in Drive without requiring a local teacher song.
- Assigned distribution metadata receives the copied Drive file IDs.
- Existing student assignment distribution flow remains separate.
- Main JavaScript syntax and Phase 7 CSS balance continue to pass.
- Same-browser Drive token renewal was simulated: an expired token silently obtained a fresh token and subsequent Drive requests reused it without another prompt.

Pending real-account checks:
- Connect Google Drive and confirm DT Music Trainer Pro / Library is created beside Assigned Materials.
- Confirm existing local songs receive song folders/files in Drive without losing the local copies.
- Open Music Trainer Pro on a second teacher browser/device and confirm the full song catalogue appears before downloading any files.
- On that second device, select a cloud song and confirm no file is cached merely by selecting the row.
- Open only the PDF and confirm only the PDF becomes cached; Interactive/Backing should remain cloud-only until opened.
- Open Interactive next and confirm it caches and launches Practice.
- Use Cache & Play on a backing track and confirm the audio is cached and playable.
- Replace a cloud asset and confirm the Drive master updates and another device sees the new version.
- Assign a cloud-only song from a fresh teacher browser and confirm Assigned Materials is created/updated without manually opening/caching the song first.
- Log in as the student and confirm the assignment still downloads from Assigned Materials without exposing the teacher Library UI.
- Delete an unassigned cloud song and confirm its Drive Library folder is moved to trash and it disappears from the catalogue.
- Confirm an assigned song remains protected from deletion.
- Use Save ZIP from a partially cached device and confirm the backup contains all cloud assets after the explicit hydration step.
- Import a ZIP and confirm restored songs sync into the Drive master while cloud songs not in the ZIP are not silently deleted.
- Check the larger typography on desktop, tablet and phone for wrapping/overflow regressions.


## Phase 7.9 — Cloud Library & Readability

Automated/source-level checks already passed:
- Song Library catalogue reads from the cloud Library index when available and falls back to IndexedDB only if needed.
- Assignment Wizard also reads the cloud Library index, so cloud-only songs can be selected on a fresh teacher device.
- Clicking/selecting a Library song does not call the download/cache API.
- Opening Interactive caches only the interactive score.
- Opening PDF caches only the PDF.
- Opening/playing Backing caches only the backing track.
- Google Drive master Library and Assigned Materials remain separate folders.
- Master Library files are uploaded without public sharing; Assigned Materials copies are explicitly shared for student access.
- Assignment publishing can copy an existing Drive master file directly into Assigned Materials without requiring a teacher-device download first.
- Cached-vs-cloud asset revision comparison is present so stale local assets are replaced when a newer master version exists.
- Full ZIP backup deliberately hydrates uncached cloud assets only when the teacher explicitly requests Save ZIP.
- Comfortable typography scale is present across the Phase 7 shell, student views, teacher views, Library, Assignment Wizard, Practice, auth and compatibility surfaces.
- Main JavaScript files parse and the Phase 7 CSS remains structurally balanced.

Pending live checks:
- Connect Google Drive as teacher and confirm DT Music Trainer Pro / Library and DT Music Trainer Pro / Assigned Materials both exist.
- Add a new song and confirm its song folder/files appear inside the Drive Library.
- On a second/fresh teacher browser, confirm the song appears in Library before opening any file.
- On that fresh browser, select the song row and confirm no large file is downloaded/cached merely by selecting it.
- Open Interactive and confirm only the interactive file becomes cached.
- Then open PDF and confirm PDF becomes cached independently.
- Then play Backing and confirm the audio file becomes cached independently.
- Refresh after each cache step and confirm cached status remains correct.
- Replace one asset on device A; on device B confirm the newer cloud asset is fetched the next time that asset is opened.
- Create an assignment from a cloud-only song on a fresh teacher device and confirm Assigned Materials is published without having to manually open/cache the song first.
- Confirm a student receives only the assigned material and never sees the teacher's full Library catalogue.
- Verify the larger font scale visually on desktop, tablet and phone, especially Library badges, Dashboard metadata, Profile history, Assignment Wizard labels and Practice controls.
- Confirm the larger type does not create overflow at 360–430px widths.


## Practice transport regression — 2026-10-24

Real fixture files used:
- Rockschool Drums Debut - Yellow(1).mxl
- RGP G0 Yellow (full) with vocals.mp3
- RGP G0 Yellow (bt click) with vocals.mp3

Fixture validation:
- MXL parses successfully as one Drum Kit part with 19 measures, 4/4 time and tempo 87 BPM.
- Score contains 235 note/rest events, including 221 unpitched percussion notes across voices 1 and 2.
- Full backing decodes successfully at about 64.29 seconds.
- Click backing decodes successfully at about 66.28 seconds.
- Beat/onset analysis shows the click-backing musical grid is about 1.974 seconds later than the full backing, confirming each backing version requires its own sync-point map.
- Both MP3s seek/decode successfully at the expected bar-2 test positions.

Automated/source regression checks passed:
- Main JavaScript files parse successfully.
- Application CSS files have balanced braces.
- Static index HTML has no duplicate IDs.
- Practice shell has no missing direct DOM references.
- Space triggers Play/Pause only in Practice and repeated keydown events are ignored.
- S triggers Stop only in Practice and repeated keydown events are ignored.
- Synth playback captures the cursor position at Play and Pause returns to that captured position.
- Starting at bar 2, playing forward, pausing and playing again preserves the bar-2 anchor.
- Moving the cursor while paused establishes a new anchor on the next Play.
- With Loop enabled, an anchor inside A-B is preserved; an anchor outside A-B clamps to A.
- Backing playback derives its start from the score cursor through score-tick -> audio-time mapping rather than stale audio.currentTime.
- Backing Count In remains enabled, is speed-aware, and can be cancelled by Play/Pause, Stop, source switching or audio-version switching.
- Rapid Synth Play/Pause during count-in is guarded by an explicit play-intent state.
- Backing loop boundaries use the exact playback-range ticks instead of collapsing draggable A/B positions to whole bars.
- A/B drag coordinates use alphaTab's .at-surface coordinate scaling (offsetWidth/rendered width and offsetHeight/rendered height).
- A/B loop state is cleared when a new score loads.
- Backing versions keep separate sync-point maps and a newly selected unsynced backing version auto-syncs before synced playback resumes.
- Practice transport cache-busting is updated so browsers request the current app.js and phase7-shell.js.
- A standalone transport state-machine regression harness passed 10 assertions covering bar-2 pause-return, new cursor anchors, loop clamping, backing timing offsets, speed-aware count-in duration and count-in cancellation.

Bugs fixed during this regression:
- Backing Count In logic existed but the core UI still disabled Count In in backing mode.
- Backing Count In could stack multiple asynchronous count-ins after repeated Play presses.
- Pause-return relied on a potentially stale player-state flag.
- Backing Play used stale audio.currentTime instead of the notation cursor when choosing a new start position.
- Backing draggable loops were reduced to whole-bar audio boundaries.
- Loop-handle drag math used the outer alphaTab element instead of alphaTab's rendered .at-surface coordinate system.
- Loop Beat objects could leak into the next loaded score.
- Switching backing versions while synced could leave a version without a usable sync map.
- The deployment query string was not refreshed after some transport changes, allowing older cached JavaScript to remain active.
- Removed stale "Press Start Practice" guidance after the simplified transport removed that button.

Still requires a real deployed-browser check:
- Visually drag A/B on the deployed alphaTab score at multiple zoom levels and confirm the handles stay aligned with the intended beats.
- Audibly confirm Synth and backing Count In timing on the deployed site.
- Confirm browser audio permissions/autoplay policies on the user's normal desktop/mobile browsers.
- Confirm Google Drive/Firebase-backed audio-version hydration in an authenticated account.
