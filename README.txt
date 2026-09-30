DT Music Trainer – Interactive Score Prototype

WHAT THIS IS
- First isolated prototype for the Songsterr-style part of DT Music Trainer.
- It does NOT replace your existing Music Trainer yet.
- It is designed to prove that Guitar Pro / MusicXML rendering and playback work well before we connect it to your existing Library.

FEATURES IN THIS PROTOTYPE
- Upload Guitar Pro / MusicXML files locally
- Standard notation / tab rendering (depending on the uploaded score)
- alphaTab MIDI playback with moving playback cursor
- Play / pause / stop
- Playback speed: 25%–150%
- Metronome
- Count-in
- Track selector
- All-tracks view
- Zoom
- Loop selected bar range
- Responsive desktop/tablet/mobile layout
- Built-in alphaTab test-song button

HOW TO TEST
1. Upload interactive-score.html to your GitHub musictrainer repository.
2. Open:
   https://derektyc.github.io/musictrainer/interactive-score.html
3. Press "Open alphaTab Test Song" first.
4. If that works, upload one of your own .gp/.gpx/.gp5 files.
5. Test playback, track switching, speed, metronome and bar looping.

IMPORTANT
- This prototype uses alphaTab 1.8.4 from jsDelivr.
- Therefore the interactive-score component needs an internet connection for alphaTab, the music font and SoundFont.
- Once the feature is confirmed working, the next build can place alphaTab assets inside your GitHub/PWA package so the interactive score can work offline too.

NEXT INTEGRATION
Once this prototype works on your PC/tablet:
- Add Guitar Pro/MusicXML as supported file types inside the existing DT Music Trainer Library.
- Add an "Open Interactive" action beside PDF/MP3.
- Store interactive score files in the same IndexedDB/Drive/ZIP workflow.
- Associate PDF + interactive score + MP3/WAV with the same song.
- Later sync real backing tracks to the interactive score.
