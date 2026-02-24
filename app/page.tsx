"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Stage = "idle" | "loading-ffmpeg" | "ready" | "converting" | "done" | "error";

// ─── Icons ──────────────────────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// ─── Waveform Animation ─────────────────────────────────────────────────────────
function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={`wave-bar w-[3px] rounded-full origin-bottom ${active ? "bg-accent-green" : "bg-text-muted"}`}
          style={{
            height: "28px",
            animationPlayState: active ? "running" : "paused",
            transform: active ? undefined : "scaleY(0.25)",
            opacity: active ? undefined : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ─── Format bytes ───────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check Web Share API support
    setCanShare(
      typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator
    );
  }, []);

  // Clean up blob URLs
  useEffect(() => {
    return () => {
      if (outputUrl) URL.revokeObjectURL(outputUrl);
    };
  }, [outputUrl]);

  const loadFFmpeg = async (): Promise<FFmpeg> => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";

    ffmpeg.on("progress", ({ progress: p }) => {
      setProgress(Math.round(p * 80 + 10)); // 10–90%
    });

    setProgressLabel("Loading FFmpeg engine…");
    setProgress(5);

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const processFile = async (file: File) => {
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/m4a", "audio/aac"];
    const isAudio = allowed.includes(file.type) || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i);

    if (!isAudio) {
      setError("Please upload an audio file (MP3, WAV, OGG, M4A, AAC).");
      setStage("error");
      return;
    }

    setInputFile(file);
    setOutputBlob(null);
    setOutputUrl(null);
    setError(null);
    setStage("converting");
    setProgress(0);

    try {
      const ffmpeg = await loadFFmpeg();

      setProgressLabel("Reading audio file…");
      setProgress(8);

      const inputName = "input" + file.name.slice(file.name.lastIndexOf("."));
      const outputName = "output.ogg";

      await ffmpeg.writeFile(inputName, await fetchFile(file));

      setProgressLabel("Converting to OGG Opus…");
      setProgress(15);

      // Convert to OGG with Opus codec — the format WhatsApp recognises as a voice note
      await ffmpeg.exec([
        "-i", inputName,
        "-c:a", "libopus",
        "-b:a", "32k",
        "-vbr", "on",
        "-compression_level", "10",
        "-application", "voip",   // optimises for voice
        "-ar", "48000",
        "-ac", "1",               // mono — voice notes are mono
        outputName,
      ]);

      setProgressLabel("Finalising…");
      setProgress(95);

      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: "audio/ogg; codecs=opus" });
      const url = URL.createObjectURL(blob);

      // Cleanup ffmpeg virtual FS
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      setOutputBlob(blob);
      setOutputUrl(url);
      setOutputSize(blob.size);
      setProgress(100);
      setProgressLabel("Done!");
      setStage("done");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Conversion failed. Please try again.");
      setStage("error");
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    processFile(files[0]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleShare = async () => {
    if (!outputBlob || !inputFile) return;

    const fileName = inputFile.name.replace(/\.[^.]+$/, "") + "_voicenote.ogg";
    const file = new File([outputBlob], fileName, {
      type: "audio/ogg; codecs=opus",
    });

    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Voice Note",
        });
      } else {
        // Fallback: download
        handleDownload();
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        handleDownload();
      }
    }
  };

  const handleDownload = () => {
    if (!outputUrl || !inputFile) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = inputFile.name.replace(/\.[^.]+$/, "") + "_voicenote.ogg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    setStage("idle");
    setInputFile(null);
    setOutputBlob(null);
    setOutputUrl(null);
    setError(null);
    setProgress(0);
  };

  const isConverting = stage === "converting";
  const isDone = stage === "done";
  const isError = stage === "error";

  return (
    <div className="grain min-h-screen flex flex-col">
      {/* Background ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(37,211,102,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-surface-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-green flex items-center justify-center text-surface-0">
            <MicIcon />
          </div>
          <span className="font-bold text-lg tracking-tight">VoiceNote</span>
        </div>
        <div className="flex items-center gap-2 text-text-muted font-mono text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block animate-pulse-slow" />
          Browser-only · Zero uploads
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">
        {/* Hero text */}
        <div className="text-center animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight mb-3">
            Audio →{" "}
            <span className="text-accent-green">WhatsApp</span>
            <br />
            Voice Note
          </h1>
          <p className="text-text-secondary text-base max-w-md mx-auto leading-relaxed">
            Upload an MP3 or WAV from ElevenLabs and convert it to the exact OGG Opus format that WhatsApp recognises as a native voice note.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-lg animate-fade-in-up-delay">
          {/* ── Idle / Ready: Drop zone ── */}
          {(stage === "idle" || stage === "ready") && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-5
                cursor-pointer transition-all duration-200 group
                ${isDragOver
                  ? "border-accent-green bg-accent-green-glow scale-[1.01]"
                  : "border-surface-3 hover:border-accent-green-dim hover:bg-surface-1"
                }
              `}
            >
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-200
                ${isDragOver ? "bg-accent-green text-surface-0" : "bg-surface-2 text-text-secondary group-hover:bg-accent-green group-hover:text-surface-0"}
              `}>
                <UploadIcon />
              </div>
              <div className="text-center">
                <p className="font-semibold text-text-primary mb-1">
                  Drop your audio file here
                </p>
                <p className="text-text-secondary text-sm">
                  or click to browse · MP3, WAV, OGG, M4A, AAC
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* ── Converting ── */}
          {isConverting && (
            <div className="border border-surface-2 rounded-2xl p-10 flex flex-col items-center gap-6 bg-surface-1">
              <Waveform active={true} />

              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-mono text-text-secondary">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full shimmer-bar rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {inputFile && (
                <p className="text-text-muted text-xs font-mono truncate max-w-xs">
                  {inputFile.name}
                </p>
              )}
            </div>
          )}

          {/* ── Done ── */}
          {isDone && outputUrl && (
            <div className="border border-accent-green/20 rounded-2xl bg-surface-1 overflow-hidden glow-pulse animate-fade-in-up">
              {/* Success header */}
              <div className="bg-accent-green/10 border-b border-accent-green/20 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-green flex items-center justify-center text-surface-0 flex-shrink-0">
                  <CheckIcon />
                </div>
                <div>
                  <p className="font-semibold text-accent-green text-sm">Conversion complete</p>
                  <p className="text-text-muted text-xs font-mono">audio/ogg; codecs=opus · {formatBytes(outputSize)}</p>
                </div>
              </div>

              {/* Audio player */}
              <div className="px-6 py-5">
                <div className="mb-4">
                  <p className="text-text-secondary text-xs font-mono mb-2 uppercase tracking-widest">Preview</p>
                  <audio controls src={outputUrl} className="w-full rounded-lg" style={{ accentColor: "#25D366" }} />
                </div>

                {/* File info */}
                {inputFile && (
                  <div className="bg-surface-2 rounded-xl px-4 py-3 flex items-center justify-between mb-5">
                    <div className="min-w-0">
                      <p className="text-text-primary text-sm font-medium truncate">{inputFile.name}</p>
                      <p className="text-text-muted text-xs font-mono">{formatBytes(inputFile.size)} → {formatBytes(outputSize)}</p>
                    </div>
                    <span className="ml-4 flex-shrink-0 text-xs font-mono bg-accent-green/10 text-accent-green px-2 py-1 rounded-lg border border-accent-green/20">
                      .ogg
                    </span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-3">
                  {/* Share button (primary) */}
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center justify-center gap-2.5 bg-accent-green hover:bg-accent-green-dim text-surface-0 font-bold py-3.5 px-6 rounded-xl transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <WhatsAppIcon />
                    {canShare ? "Share as Voice Note" : "Download Voice Note (.ogg)"}
                  </button>

                  {/* Download (secondary, shown only if share is available) */}
                  {canShare && (
                    <button
                      onClick={handleDownload}
                      className="w-full flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary border border-surface-3 hover:border-text-muted py-3 px-6 rounded-xl transition-all duration-150 text-sm"
                    >
                      <DownloadIcon />
                      Save as file instead
                    </button>
                  )}

                  {/* WhatsApp tip */}
                  <p className="text-text-muted text-xs text-center leading-relaxed">
                    On mobile: tap <span className="text-accent-green">Share as Voice Note</span> then pick WhatsApp.<br />
                    WhatsApp will show this as a 🎙️ voice message, not a music file.
                  </p>
                </div>
              </div>

              {/* Convert another */}
              <div className="border-t border-surface-2 px-6 py-3">
                <button
                  onClick={reset}
                  className="text-text-muted hover:text-text-secondary text-xs font-mono transition-colors"
                >
                  ← Convert another file
                </button>
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {isError && (
            <div className="border border-red-500/20 rounded-2xl bg-surface-1 p-8 flex flex-col items-center gap-4 animate-fade-in-up">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                <AlertIcon />
              </div>
              <div className="text-center">
                <p className="font-semibold text-red-400 mb-1">Something went wrong</p>
                <p className="text-text-secondary text-sm max-w-xs leading-relaxed">{error}</p>
              </div>
              <button
                onClick={reset}
                className="mt-2 text-text-secondary hover:text-text-primary border border-surface-3 hover:border-text-muted py-2.5 px-6 rounded-xl text-sm transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Info cards */}
        {stage === "idle" && (
          <div className="w-full max-w-lg grid grid-cols-3 gap-3 animate-fade-in-up-delay-2">
            {[
              { label: "Browser-only", desc: "No server. Files never leave your device." },
              { label: "Opus codec", desc: "The exact format WhatsApp uses for voice notes." },
              { label: "48kHz mono", desc: "Voice-optimised settings for small, clear files." },
            ].map((item) => (
              <div key={item.label} className="bg-surface-1 border border-surface-2 rounded-xl p-4">
                <p className="font-semibold text-text-primary text-sm mb-1">{item.label}</p>
                <p className="text-text-muted text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-5 text-text-muted text-xs font-mono border-t border-surface-2">
        FFmpeg runs entirely in your browser via WebAssembly · No data is transmitted
      </footer>
    </div>
  );
}
