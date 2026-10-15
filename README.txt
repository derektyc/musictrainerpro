DT Music Trainer Pro — Phase 7.8

Repository scope
- This application lives only in derektyc/musictrainerpro.
- The original derektyc/musictrainer repository is not modified.

CURRENT APPLICATION
Phase 7 is the full application redesign around the existing working music/practice engines.

Teacher navigation
- Dashboard
- Students
- Assignments
- Library
- Practice

Student navigation
- Home
- Assignments
- Practice
- Progress

PHASE 7 FEATURES
7.1 Application shell
- Dedicated teacher/student navigation.
- Desktop sidebar and responsive bottom navigation.
- Existing engines are mounted inside the new application shell.

7.2 Student experience
- Today's assignment and guided practice entry.
- Student assignment list, practice guidance, completion summary and progress history.
- Automatic repetition / speed progression remains powered by the existing Practice engine.

7.3 Teacher dashboard
- Student activity, assignment attention items and weekly practice overview.

7.4 Student profiles
- Active assignments, recent practice, assignment history and teacher-only notes.
- Teacher-only notes are kept on the teacher account rather than student-readable records.

7.5 Assignment wizard
- Guided Student → Song → Practice → Review workflow.
- Existing Advanced Manager remains available for compatibility operations.

7.6 Song Library
- Searchable catalogue with Interactive / PDF / Backing / Assigned / Incomplete filters.
- Add Song, bulk drag-and-drop grouping, asset replacement, previews and Library Health.
- Assigned-song deletion safeguards.
- Library → Assign integrates directly with the assignment wizard.
- Save Library ZIP / Load Library ZIP remains available.

7.7 Practice player
- Score-first practice screen.
- Simplified Play, Restart, Loop, Speed, Zoom, Synth/Backing, PDF and Guided Practice controls.
- Teacher Advanced Tools are hidden until requested.
- Student practice remains intentionally simplified.
- Count-in appears at the top-left of the score without blurring the notation.

7.8 Final polish
- Tablet/phone shell switches to bottom navigation before the desktop sidebar becomes cramped.
- Dynamic viewport sizing and safe-area support for mobile browser/PWA-style use.
- Mobile form anti-zoom, touch-target and overflow hardening.
- Small-phone and landscape practice refinements.
- Keyboard focus states, aria-current navigation, dialog semantics and reduced-motion support.
- Old phase-number copy removed from the normal UI.

STORAGE AND CLOUD ARCHITECTURE
- Local song library: IndexedDB.
- Teacher/student accounts and assignment/progress sync: Firebase Authentication + Firestore.
- Assigned song materials: existing Google Drive publishing flow.
- Student devices download/cache assigned materials locally.
- Firebase Storage is not used.

SUPPORTED INTERACTIVE SCORE FILES
- .gp
- .gpx
- .gp3 / .gp4 / .gp5 / .gp6 / .gp7 / .gp8
- .musicxml
- .mxl
- .xml

OTHER SUPPORTED MATERIALS
- PDF
- MP3
- WAV

MuseScore native .mscz files are not opened directly. Export them as MusicXML first.

TESTING
Automated/source-level regression results and checks that require a real authenticated browser session are tracked in:
PHASE7_TESTING.md

The live-check list is intentionally retained so Firebase, Google Drive, audio playback, real device sizing and student/teacher account behaviour can be verified later without losing track of outstanding tests.
