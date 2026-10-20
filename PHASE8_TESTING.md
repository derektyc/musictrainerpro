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
