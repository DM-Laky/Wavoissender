# VoiceNote — WhatsApp Voice Note Converter

Convert any MP3/WAV/OGG/M4A audio into a WhatsApp-native voice note (OGG Opus), entirely in the browser using FFmpeg.wasm. No server. No uploads. Zero privacy concerns.

## ✨ Features

- **Browser-only conversion** — FFmpeg runs via WebAssembly in the user's browser
- **Correct MIME type** — `audio/ogg; codecs=opus` ensures WhatsApp treats it as a 🎙️ voice note, not a music file
- **Web Share API** — On mobile, tap "Share as Voice Note" and pick WhatsApp directly
- **Voice-optimised settings** — 48kHz, mono, Opus codec, `voip` application flag
- **Dark UI** — Clean, modern interface

## 🚀 Deploy to Vercel (1-minute setup)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/whatsapp-voice-note.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Click **Deploy** — no environment variables needed

> ⚠️ **Important:** The `next.config.js` sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. These are **required** for `SharedArrayBuffer` which FFmpeg.wasm needs for its multi-threaded core. Vercel respects these headers automatically.

## 🛠️ Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 📱 How WhatsApp Voice Note Sharing Works

### On Mobile (Android/iOS)
1. Upload your MP3/WAV from ElevenLabs
2. Tap **"Share as Voice Note"**
3. Pick WhatsApp from the share sheet
4. WhatsApp receives a `.ogg` file with MIME type `audio/ogg; codecs=opus`
5. WhatsApp displays it as a native 🎙️ voice note with a waveform

### On Desktop
The Web Share API is not available on desktop browsers. The app falls back to downloading the `.ogg` file, which you can then manually attach in WhatsApp Web.

## 🔧 FFmpeg Conversion Settings

```
-c:a libopus        # Opus codec
-b:a 32k            # 32kbps bitrate (ideal for voice)
-vbr on             # Variable bitrate
-compression_level 10
-application voip   # Optimise for voice (not music)
-ar 48000           # 48kHz sample rate
-ac 1               # Mono (voice notes are mono)
```

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **@ffmpeg/ffmpeg** + **@ffmpeg/core-mt** (multi-threaded WebAssembly)
- **Web Share API** for native mobile sharing
