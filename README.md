# 🤖 Noor — the AI Robot Helper

A friendly voice assistant for the Grade 5 project **"Design an AI Robot."**
Talk to Noor with the microphone (or type), and she answers out loud and in the chat.

* Answers school questions, explains lessons and new words, helps with homework step by step
* Calculates maths exactly (“Noor, what is twelve multiplied by eight?”)
* Tells short, kind stories
* Sets **real** timers and reminders (with a countdown and a spoken + beep alert) while the page is open
* Remembers your name during the conversation, accepts corrections, and understands “explain that again”, “make it shorter”, “give me another example”
* Recognises **hand gestures** with the laptop camera (open palm, point left/right, thumbs up, closed fist)
* Has a **Homework helper** panel with a study timer
* Has an **About Noor** section (purpose, sensors, AI features, benefits, limitations, labeled robot picture)

## 1. Install (once)

You need **Node.js 18 or newer** (download from https://nodejs.org, choose "LTS").

```bash
cd Project-MY
npm install
```

## 2. Start Noor

```bash
npm start
```

Then open **http://localhost:3000** in **Google Chrome** or **Microsoft Edge**.
(Use the `localhost` address — browsers only allow the microphone on `localhost` or `https`.)
Press `Ctrl+C` in the terminal to stop.

The badge at the top tells you the mode:

| Badge | Meaning |
|---|---|
| ✨ **AI mode: connected** | Noor uses the AI service for smart answers |
| 🧪 **DEMO MODE (no AI key)** | Works with no key and no AI (see below) |

## 3. Turn on the AI connection (optional but recommended)

1. Get an API key at https://console.anthropic.com/ (create an account, then **API Keys**).
2. Copy the example settings file and put your key in it:
   * Mac/Linux: `cp .env.example .env`
   * Windows: `copy .env.example .env`
3. Open `.env` in any text editor and replace `your-api-key-here` with your key:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
4. Restart with `npm start`. The badge should say **AI mode: connected**.

**How it is kept safe:** the key lives only in `.env` on the server (`.env` is in `.gitignore`, so it is never uploaded).
The web page never sees it: the browser talks to `/api/chat` on *your* server, and the server talks to the AI.
The whole chat history and the remembered name are sent with every request so Noor can follow the conversation.

Optional settings in `.env`: `ANTHROPIC_MODEL` (default `claude-haiku-4-5-20251001`, fast and low cost), `PORT` (default 3000), `NOOR_MODE=demo` (force Demo Mode).
If the AI is unreachable (no internet, wrong key), Noor says so in the chat and uses the Demo brain for that answer.

## Demo Mode (no key needed)

Without a key Noor uses a small offline brain. It is clearly labeled in the page. It supports:

* Greetings, name memory and corrections, “how are you”, simple feelings
* Follow-ups: “explain that again”, “make it shorter”, “give me another example”, “tell me more”
* Maths, timers, reminders, the time and date (these work the same in both modes)
* 4 short stories (kindness, honesty, never giving up, teamwork) and 3 jokes
* About 30 word meanings (“what does habitat mean?”)
* 9 school topics: water cycle, photosynthesis, gravity, solar system, fractions, food chains, states of matter, volcanoes, nouns/verbs/adjectives

Anything else gets a polite “I'm not sure in Demo Mode” message. Real homework help on any subject needs AI mode.

## Using Noor

* **Talk:** press the big green **🎤 Talk to Noor** button, allow the microphone when the browser asks, and speak. You see your words appear live. When you stop speaking, the message is sent automatically. Press the button again (it is red and says **Stop**) to finish early.
* **Wrong words?** Under the button, **✏️ Fix it** puts what Noor heard into the text box for you to edit; **🎤 Say it again** listens again.
* **Voice:** **Voice: On/Off** mutes Noor's voice, **Stop talking** interrupts her, and you can pick a voice and speed. Tick *Keep listening after Noor talks* for hands-free chatting.
* **Status:** the robot and the label show **Listening**, **Thinking** or **Speaking**. The microphone is switched off whenever Noor speaks, so she never hears herself.
* **Typing** always works, even if the microphone is blocked.
* **New Conversation** clears the chat and the remembered name (running timers are kept).

Things to try: “Open the homework panel” · “Start my study timer” · “Start a new conversation” · “Hi, my name is Muhammad” · “Explain the water cycle” · “Explain that again” · “What is twelve multiplied by eight?” · “Tell me a short story about kindness” · “Set a timer for one minute” · “Remind me to drink water in 10 minutes” · “How much time is left?” · “Cancel the timer” · “Stop”

## Hand gestures (camera)

Press **📷 Turn on gestures** (left side). The browser asks for permission to use the camera; choose *Allow*. A small mirror-style preview appears with your hand outlined, plus the gesture Noor sees and a bar that fills while you hold it steady. Press the button again to turn the camera off. Voice and typing work the same whether the camera is on or off.

| Gesture | What Noor does |
|---|---|
| ✋ Open palm | Waves and says “Hello!” (with your name if she knows it) |
| 👈 Point left / 👉 point right | Turns her on-screen face left or right for a few seconds (left and right match the mirror preview you see) |
| 👍 Thumbs up | Says **yes** to something Noor just asked, e.g. “Shall I start a study timer for 10 minutes?” |
| ✊ Closed fist | Stops talking and cancels what she is doing: pending question, listening, and a reply that is still being prepared (running timers keep going; say “cancel the timer” for those) |

Try the thumbs-up flow: say or type **“start my study timer”** → Noor asks to confirm → show 👍 (or say “yes”, or press **Yes**). Fist, “no”, or **No** cancels. “Start a new conversation” also asks first.

**Gestures can only control Noor's own app** (waving, turning her face, confirming a question, stopping her, opening the Homework helper, starting its study timer). A web page cannot control other programs on the laptop, and Noor does not claim to.

**Tips for good detection:** face a window or lamp (not a bright light behind you), keep **one** hand in the picture, about an arm's length from the camera, and hold the gesture steady for about one second.

**How it avoids accidents:** a gesture must stay steady for about 0.8 seconds (0.5 s for the fist); one action fires only once until the gesture changes or the hand leaves for 0.4 s; there is a 1.5 s cooldown between actions; if there is more than one hand, no hand, or the model is not sure, Noor waits and does nothing.

**Privacy:** the camera picture is shown only in the little preview and analysed on this laptop by the hand-tracking model. It is never saved, never put into a file, and never sent to the server or the internet.

**Technology:** [MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) (`@mediapipe/tasks-vision` 0.10.21, Apache-2.0, copied into `public/vendor/mediapipe/`). It finds 21 landmark points on a hand and names common gestures; Noor adds her own finger-geometry rule for pointing left/right and double-checks the open palm.

**Internet needed?** Not at all for gestures. The hand-tracking library (`public/vendor/mediapipe/`, about 20 MB) and the model file (`public/models/gesture_recognizer.task`, 8 MB) are both included in the project, so **gestures work offline** and need no extra download. (If the model file is ever missing, re-download it from Google: `https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task` and save it in `public/models/`.)

**Camera troubleshooting (Windows):** Settings → Privacy & security → Camera → allow desktop apps / Chrome; close Zoom, Teams or the Camera app if they are using the camera; click the 🔒 icon next to the address and set Camera to *Allow*.

## Which browsers work?

| Feature | Chrome / Edge (laptop) | Safari | Firefox |
|---|---|---|---|
| Typing, chat, timers, maths | ✅ | ✅ | ✅ |
| Spoken replies (speech synthesis) | ✅ | ✅ | ✅ |
| Microphone input (speech recognition) | ✅ best choice | ⚠️ partial / not reliable | ❌ not supported |
| Camera hand gestures | ✅ | ⚠️ not tested | ⚠️ not tested |

Chrome and Edge send the audio to an online speech service, so **voice input needs the internet**. If the browser does not support it, the microphone button is disabled with a message and typing still works.

## Troubleshooting

* **Microphone blocked:** click the 🔒 icon next to the address, set Microphone to *Allow*, reload.
* **Noor can't hear me:** check the laptop's input device in system sound settings; speak close to the mic; reduce background noise.
* **No voice:** check the laptop volume and that *Voice: On* is shown. Voices differ by computer; try another in the *Voice* menu.
* **Port already in use:** run with another port, e.g. `PORT=3001 npm start` (Windows PowerShell: `$env:PORT=3001; npm start`).

## For the curious: how the code is organised

| File | Job |
|---|---|
| `server.js` | Small Express server: serves the page and forwards chat to the AI (keeps the key secret) |
| `public/index.html`, `style.css` | The page, robot drawing, About section |
| `public/app.js` | Microphone, voice output, chat, timers, status |
| `public/gestures.js` | Camera on/off, preview, runs the hand-tracking model |
| `public/gesture-logic.js` | Gesture rules and the “steady hold / once only / cooldown” logic (testable without a camera) |
| `public/vendor/mediapipe/` | The hand-tracking library (copied in, so no download is needed) |
| `public/models/` | The hand-tracking model file |
| `public/noor-logic.js` | Maths, number words, name memory, timer commands, Demo brain (no browser code, so it is easy to test) |
| `test/` | Automatic tests (`npm test`) |
| `.env.example` | Template for your settings |

Run the automatic tests with `npm test` (they use a fake AI, so no key or internet is needed).

## What was verified

**Automatic tests** (`npm test`, 17 tests): maths, number words, names, durations, timer/reminder/homework commands, demo conversation with follow-ups, the backend against a fake AI service, and gesture classification using *real* hand landmarks recorded from the real model on real hand photos (fist, thumbs up, open palm, pointing left/right, peace sign, two hands), plus the steady-hold / fire-once / cooldown / flicker rules.

**Real browser (Chromium) with a scripted microphone and speaker:** typed chat, voice flow with live text, auto-submit, mic off while Noor speaks, name memory and correction, maths read aloud, follow-ups, real timers with alerts, cancel, mute, unclear speech / no speech / denied permission, Fix it, New Conversation, AI mode with history forwarded and fallback when the AI fails.

**Real browser with a fake webcam fed by real hand photos (real camera pipeline + real MediaPipe model):** camera permission and on/off, preview with hand outline, thumbs up confirming “start my study timer” (fires once even when held), closed fist cancelling a pending action and stopping speech, open palm greeting with the remembered name and waving, pointing left/right turning the face (and returning to centre), two hands / unrelated gesture / a 0.4-second flash all doing nothing, camera denied showing a friendly message with typing still working, and **no network requests other than to localhost and no uploads**.

**Not verified here (no hardware in the test environment):** a real microphone, real speakers, and a real webcam with a live person. Please do a quick 2-minute check on your Windows laptop before the presentation: try each of the five gestures and a spoken question. If a gesture is slow to register, improve the lighting and hold it steady for a full second.
