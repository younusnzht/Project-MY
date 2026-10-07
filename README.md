# 🤖 Noor — the AI Robot Helper

A friendly voice assistant for the Grade 5 project **"Design an AI Robot."**
Talk to Noor with the microphone (or type), and she answers out loud and in the chat.

* Answers school questions, explains lessons and new words, helps with homework step by step
* Calculates maths exactly (“Noor, what is twelve multiplied by eight?”)
* Tells short, kind stories
* Sets **real** timers and reminders (with a countdown and a spoken + beep alert) while the page is open
* Remembers your name during the conversation, accepts corrections, and understands “explain that again”, “make it shorter”, “give me another example”
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

Things to try: “Hi, my name is Muhammad” · “Explain the water cycle” · “Explain that again” · “What is twelve multiplied by eight?” · “Tell me a short story about kindness” · “Set a timer for one minute” · “Remind me to drink water in 10 minutes” · “How much time is left?” · “Cancel the timer” · “Stop”

## Which browsers work?

| Feature | Chrome / Edge (laptop) | Safari | Firefox |
|---|---|---|---|
| Typing, chat, timers, maths | ✅ | ✅ | ✅ |
| Spoken replies (speech synthesis) | ✅ | ✅ | ✅ |
| Microphone input (speech recognition) | ✅ best choice | ⚠️ partial / not reliable | ❌ not supported |

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
| `public/noor-logic.js` | Maths, number words, name memory, timer commands, Demo brain (no browser code, so it is easy to test) |
| `test/` | Automatic tests (`npm test`) |
| `.env.example` | Template for your settings |

Run the automatic tests with `npm test` (they use a fake AI, so no key or internet is needed).

## What was verified

Automatic: `npm test` (maths, number words, names, durations, timer/reminder commands, demo conversation with follow-ups, backend with a fake AI service).
In a real Chromium browser with a scripted microphone and speaker (so it can run without a person): typed chat, voice flow with live text, auto-submit, mic off while Noor speaks, name memory and correction, maths read aloud, follow-up questions, real countdown and alert (beep + spoken + on-screen), duration follow-up (“set a timer” → “two minutes”), cancel, mute, unclear speech / no speech / denied permission messages, Fix it, New Conversation reset, AI mode with the history and name forwarded, and the fallback when the AI fails.
**Not verified here:** a real physical microphone and real laptop speakers (the test environment has neither) — please do a quick 2-minute check on your laptop before the presentation.
