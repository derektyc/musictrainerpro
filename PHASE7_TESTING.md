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
