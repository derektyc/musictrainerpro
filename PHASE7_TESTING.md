# Phase 7 Testing Log

Last updated: 2026-10-16

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
