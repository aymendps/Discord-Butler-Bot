import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import {
  Message,
  EmbedBuilder,
  MessageCreateOptions,
  InteractionReplyOptions,
  Client,
  GuildMember,
} from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { DjMixMode, Song, SongQueue } from "../interfaces/song";
import { executePlaySong } from "./playSong";
import { AudioPlayer } from "@discordjs/voice";
import { DJ_TEMP_DIR, DJ_ASSETS_DIR, DJ_SFX_DIR } from "../config";
import { create as createYtDlExec } from "youtube-dl-exec";
import { getInnertubeAgent } from "../main";
import { YTNodes } from "youtubei.js";
import { TinyspawnPromise } from "tinyspawn";
import { exec } from "child_process";

const DJ_OUTPUT = path.join(DJ_TEMP_DIR, "dj_mix.mp3");
const DJ_OUTPUT_WITH_SFX = path.join(DJ_TEMP_DIR, "dj_mix_with_sfx.mp3");

const ANALYSIS_SR = 22050;

// ---- tunables ----
const REPEATS = 12;
const MAX_CHUNK_SEC = 0.85;
const MIN_CHUNK_SEC = 0.45;
const CLICK_GUARD_SEC = 0.05;

const FADE_SEARCH_WINDOW_SEC = 20;
const FADE_LEVEL_RATIO = 0.6;
const FADE_MIN_TRIM_SEC = 1.5;

const RANDOM_CUT_MIN_RATIO = 0.6;
const RANDOM_CUT_MAX_RATIO = 0.8;
const RANDOM_CUT_MIN_ABS_SEC = 120;

const ONSET_SEARCH_WINDOW_SEC = 1.0;
const REPEAT_VOLUME_START = 1.0;
const REPEAT_VOLUME_END = 0.2;

const SFX_START_TIME = 5;
const SFX_INTERVAL = 55;
const SFX_INTERVAL_DELTA = 5;
const SFX_END_TIME_DELTA = 20;
const SFX_MIN_VOLUME = 0.5;
const SFX_MAX_VOLUME = 0.8;
const SFX_MAX_REPEAT_HISTORY_LENGTH = 4;

const VOICE_DUCK_VOLUME = 0.25;
const VOICE_DUCK_ATTACK_SEC = 0.25; // fade-down time as the voice line starts
const VOICE_DUCK_RELEASE_SEC = 0.4; // fade-back-up time as the voice line ends

const TRANSITION_DUCK_VOLUME = 0.3;
const TRANSITION_DUCK_ATTACK_SEC = 0.2;
const TRANSITION_DUCK_RELEASE_SEC = 0.35;
const TRANSITION_SFX_MAX_REPEAT_HISTORY_LENGTH = 2;
const TRANSITION_VOICE_GUARD_SEC = 1.0; // padding kept clear around a baked-in transition voice window

const MAX_PLAYLISTS_TO_USE = 2;
const MAX_PLAYLIST_SONGS = 5;
const MIN_VIDEO_DURATION_SEC = 60;
const MAX_VIDEO_DURATION_SEC = 600;

export async function getAudioFileDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, data) => {
      if (err) return reject(err);
      resolve(data.format.duration || 0);
    });
  });
}

// Windows imposes a hard limit (~8191 chars) on a single spawned process's
// command line. A -filter_complex string built from many tracks/SFX easily
// exceeds that and blows up with ENAMETOOLONG. Writing the filtergraph to a
// file and pointing ffmpeg at it with -filter_complex_script sidesteps the
// limit entirely, since only a short file path goes on the command line.
function writeFilterScript(filters: string[], name: string): string {
  if (!fs.existsSync(DJ_TEMP_DIR))
    fs.mkdirSync(DJ_TEMP_DIR, { recursive: true });
  const scriptPath = path.join(
    DJ_TEMP_DIR,
    `${name}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.txt`
  );
  fs.writeFileSync(scriptPath, filters.join(";\n"), "utf-8");
  return scriptPath;
}

function cleanupFilterScript(scriptPath: string) {
  fs.unlink(scriptPath, () => {
    /* best-effort cleanup, ignore errors */
  });
}

interface SfxMeta {
  file: string;
  isVoice: boolean;
  duration: number;
}

function isVoiceSfx(file: string): boolean {
  return path.basename(file).toLowerCase().includes("voice");
}

// A "transition" voice line is reserved for playing right before a track's
// repeat/stutter phase — it's never scattered randomly like other SFX.
function isTransitionSfx(file: string): boolean {
  return (
    isVoiceSfx(file) && path.basename(file).toLowerCase().includes("transition")
  );
}

function isStartSfx(file: string): boolean {
  return (
    isVoiceSfx(file) && path.basename(file).toLowerCase().includes("start")
  );
}

function getSfxFiles(): string[] {
  if (!fs.existsSync(DJ_SFX_DIR)) return [];

  return fs
    .readdirSync(DJ_SFX_DIR)
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => path.join(DJ_SFX_DIR, f));
}

async function loadSfxMeta(files: string[]): Promise<Map<string, SfxMeta>> {
  const metaMap = new Map<string, SfxMeta>();
  for (const file of files) {
    const duration = await getAudioFileDuration(file);
    metaMap.set(file, {
      file,
      isVoice: isVoiceSfx(file),
      duration,
    });
  }
  return metaMap;
}

interface TransitionSfxMeta {
  file: string;
  duration: number;
}

async function loadTransitionSfxMeta(
  files: string[]
): Promise<TransitionSfxMeta[]> {
  const metas: TransitionSfxMeta[] = [];
  for (const file of files) {
    const duration = await getAudioFileDuration(file);
    metas.push({ file, duration });
  }
  return metas;
}

function windowsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Picks a random SFX for a given slot timestamp. A voice-tagged candidate is
// only allowed if its own play window doesn't overlap a reserved transition
// voice window (padded by TRANSITION_VOICE_GUARD_SEC on each side) — two
// voice lines stacking on top of each other reads as noise. Non-voice SFX
// have no such restriction, since a sting or hit under a voice line is fine.
function pickSfxForSlot(
  files: string[],
  recent: string[],
  meta: Map<string, SfxMeta>,
  timestamp: number,
  reservedVoiceWindows: TransitionVoiceWindow[],
  isStartSlot: boolean = false
): string {
  let candidates = files.filter((f) => !recent.includes(f));
  if (isStartSlot) {
    candidates = candidates.filter((f) => isStartSfx(f));
  }
  const pool = candidates.length ? candidates : files;

  const allowed = pool.filter((f) => {
    const m = meta.get(f);
    if (!m?.isVoice) return true;

    const start = timestamp;
    const end = timestamp + (m.duration || 0);
    return !reservedVoiceWindows.some((w) =>
      windowsOverlap(
        start,
        end,
        w.start - TRANSITION_VOICE_GUARD_SEC,
        w.end + TRANSITION_VOICE_GUARD_SEC
      )
    );
  });

  // If every voice option collides with a reserved window, fall back to
  // non-voice SFX only; if that's somehow also empty, fall back to the
  // unrestricted pool rather than skipping the slot entirely.
  const nonVoiceFallback = pool.filter((f) => !meta.get(f)?.isVoice);
  const usable = allowed.length
    ? allowed
    : nonVoiceFallback.length
      ? nonVoiceFallback
      : pool;

  return usable[Math.floor(Math.random() * usable.length)];
}

// Builds a single-window "duck" volume expression: 1.0 everywhere, dipping
// down to duckLevel between [start, end] with a short fade in/out so the
// track doesn't cut abruptly under a voice line.
function buildDuckExpr(
  start: number,
  end: number,
  duckLevel: number = VOICE_DUCK_VOLUME,
  attackSec: number = VOICE_DUCK_ATTACK_SEC,
  releaseSec: number = VOICE_DUCK_RELEASE_SEC
): string {
  const rawDuration = Math.max(0, end - start);
  // Keep attack/release from overlapping on very short voice clips
  const attack = Math.min(attackSec, rawDuration / 2);
  const release = Math.min(releaseSec, rawDuration / 2);

  const s = start.toFixed(3);
  const attackEnd = (start + attack).toFixed(3);
  const releaseStart = (end - release).toFixed(3);
  const e = end.toFixed(3);
  const duck = duckLevel.toFixed(3);

  // Nested if(): before window -> 1, fade down -> duck, hold -> duck,
  // fade up -> 1, after -> 1
  return (
    `if(lt(t,${s}),1,` +
    `if(lt(t,${attackEnd}),1-(1-${duck})*(t-${s})/${Math.max(attack, 0.001)},` +
    `if(lt(t,${releaseStart}),${duck},` +
    `if(lt(t,${e}),${duck}+(1-${duck})*(t-${releaseStart})/${Math.max(release, 0.001)},` +
    `1))))`
  );
}

async function addRandomSfx(
  inputMix: string,
  outputFile: string,
  intervalSeconds = 10,
  reservedVoiceWindows: TransitionVoiceWindow[] = []
): Promise<void> {
  // Transition voice lines are reserved for the pre-repeat-phase slot in
  // createDJMix, so they're excluded from the general random-scatter pool.
  const sfxFiles = getSfxFiles().filter((f) => !isTransitionSfx(f));

  if (!sfxFiles.length) {
    console.log("No SFX files found.");
    return;
  }

  const sfxMeta = await loadSfxMeta(sfxFiles);
  const duration = await getAudioFileDuration(inputMix);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    // Input 0 = main mix
    cmd.input(inputMix);

    const filters: string[] = [];

    let inputIndex = 1;
    const delayedLabels: string[] = [];
    const duckWindows: { start: number; end: number }[] = [];

    let recentSfx = [];

    for (
      let timestamp = Math.max(SFX_START_TIME, 0);
      timestamp < duration - SFX_END_TIME_DELTA;
      timestamp +=
        intervalSeconds +
        (Math.random() >= 0.5
          ? Math.random() * SFX_INTERVAL_DELTA
          : Math.random() * -SFX_INTERVAL_DELTA) // if interval is 10s, add a random offset of -3 to +3 seconds
    ) {
      const sfx = pickSfxForSlot(
        sfxFiles,
        recentSfx,
        sfxMeta,
        timestamp,
        reservedVoiceWindows,
        timestamp == SFX_START_TIME
      );

      const meta = sfxMeta.get(sfx);

      recentSfx.push(sfx);

      // Keep last 2 played
      if (recentSfx.length > SFX_MAX_REPEAT_HISTORY_LENGTH) {
        recentSfx.shift();
      }

      cmd.input(sfx);

      const delayMs = Math.floor(timestamp * 1000);

      const volume =
        Math.random() * (SFX_MAX_VOLUME - SFX_MIN_VOLUME) + SFX_MIN_VOLUME;

      filters.push(
        `[${inputIndex}:a]` +
          `aformat=sample_rates=48000:channel_layouts=stereo,` +
          `volume=${volume.toFixed(2)},` +
          `adelay=${delayMs}|${delayMs}` +
          `[sfx${inputIndex}]`
      );

      delayedLabels.push(`sfx${inputIndex}`);

      // Voice SFX duck the main mix for the duration of the line, so it
      // sounds like someone's talking over a lowered track.
      if (meta?.isVoice && meta.duration > 0) {
        duckWindows.push({
          start: timestamp,
          end: timestamp + meta.duration,
        });
      }

      inputIndex++;
    }

    let mainLabel = "0:a";
    const resampledMain = "mainresampled";
    filters.unshift(
      `[${mainLabel}]aformat=sample_rates=48000:channel_layouts=stereo[${resampledMain}]`
    );
    mainLabel = resampledMain;

    duckWindows.forEach((win, i) => {
      const nextLabel = `ducked${i}`;
      const expr = buildDuckExpr(win.start, win.end);
      filters.push(`[${mainLabel}]volume='${expr}':eval=frame[${nextLabel}]`);
      mainLabel = nextLabel;
    });

    const mixInputs = [
      `[${mainLabel}]`,
      ...delayedLabels.map((x) => `[${x}]`),
    ].join("");

    filters.push(
      `${mixInputs}amix=inputs=${delayedLabels.length + 1}:normalize=0[out]`
    );

    const filterScriptPath = writeFilterScript(filters, "sfx_filtergraph");

    cmd
      .outputOptions(
        "-filter_complex_script",
        filterScriptPath,
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2"
      )
      .on("stderr", (line) => {
        /*console.log(line)*/
      })
      .on("error", (err) => {
        cleanupFilterScript(filterScriptPath);
        reject(err);
      })
      .on("end", () => {
        cleanupFilterScript(filterScriptPath);
        resolve();
      })
      .save(outputFile);
  });
}

interface Track {
  file: string;
  trimStart: number;
  trimEnd: number;
  playEnd: number;
  gain: number;
}

function getAudioFiles(): string[] {
  return fs
    .readdirSync(DJ_TEMP_DIR)
    .filter(
      (f) =>
        f.endsWith(".mp3") && f !== "dj_mix.mp3" && f !== "dj_mix_with_sfx.mp3"
    )
    .map((f) => path.join(DJ_TEMP_DIR, f));
}

function extractPCM(
  file: string,
  sampleRate = ANALYSIS_SR
): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = ffmpeg(file)
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .format("f32le")
      .on("error", reject)
      .pipe();
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      resolve(
        new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4))
      );
    });
    stream.on("error", reject);
  });
}

function computeRMS(region: Float32Array, windowSize: number): Float32Array {
  const numWindows = Math.floor(region.length / windowSize);
  const rms = new Float32Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    let sum = 0;
    const s = i * windowSize;
    for (let j = 0; j < windowSize; j++) sum += region[s + j] ** 2;
    rms[i] = Math.sqrt(sum / windowSize);
  }
  return rms;
}

function findSilenceBounds(samples: Float32Array, sampleRate: number) {
  const windowSize = Math.floor(sampleRate * 0.05);
  const rms = computeRMS(samples, windowSize);
  let maxRms = 0;
  for (let i = 0; i < rms.length; i++) if (rms[i] > maxRms) maxRms = rms[i];
  const threshold = maxRms * 0.05;

  let startWindow = 0;
  while (startWindow < rms.length && rms[startWindow] < threshold)
    startWindow++;
  let endWindow = rms.length - 1;
  while (endWindow > 0 && rms[endWindow] < threshold) endWindow--;

  const trimStart = Math.max(0, (startWindow * windowSize) / sampleRate - 0.05);
  const trimEnd = Math.min(
    samples.length / sampleRate,
    ((endWindow + 1) * windowSize) / sampleRate + 0.05
  );
  return { trimStart, trimEnd };
}

function findFadeStart(
  samples: Float32Array,
  sampleRate: number,
  trimStart: number,
  trimEnd: number
): number {
  const windowSize = Math.floor(sampleRate * 0.1);
  const startSample = Math.floor(trimStart * sampleRate);
  const endSample = Math.floor(trimEnd * sampleRate);
  const region = samples.subarray(startSample, endSample);
  const rms = computeRMS(region, windowSize);
  const fullContentDur = trimEnd - trimStart;
  if (rms.length < 10) return fullContentDur;

  const midStart = Math.floor(rms.length * 0.2);
  const midEnd = Math.floor(rms.length * 0.8);
  const midSlice = Array.from(rms.slice(midStart, midEnd)).sort(
    (a, b) => a - b
  );
  const reference = midSlice[Math.floor(midSlice.length / 2)] || 0;
  if (reference <= 0) return fullContentDur;

  const searchWindows = Math.min(
    rms.length,
    Math.floor((FADE_SEARCH_WINDOW_SEC * sampleRate) / windowSize)
  );
  const searchStart = rms.length - searchWindows;

  let cutoffWindow = searchStart;
  for (let i = rms.length - 1; i >= searchStart; i--) {
    if (rms[i] >= reference * FADE_LEVEL_RATIO) {
      cutoffWindow = i;
      break;
    }
  }

  const cutoffSec = ((cutoffWindow + 1) * windowSize) / sampleRate;
  const trimmedAmount = fullContentDur - cutoffSec;
  if (trimmedAmount < FADE_MIN_TRIM_SEC) return fullContentDur;
  return cutoffSec;
}

function pickRandomCut(contentDur: number): number {
  if (contentDur < RANDOM_CUT_MIN_ABS_SEC) return contentDur;
  const ratio =
    RANDOM_CUT_MIN_RATIO +
    Math.random() * (RANDOM_CUT_MAX_RATIO - RANDOM_CUT_MIN_RATIO);
  return contentDur * ratio;
}

function snapToNearestOnset(
  samples: Float32Array,
  sampleRate: number,
  trimStart: number,
  candidateSec: number,
  contentDur: number
): number {
  const windowSize = Math.floor(sampleRate * 0.02);
  const centerSample = Math.floor((trimStart + candidateSec) * sampleRate);
  const searchSamples = Math.floor(ONSET_SEARCH_WINDOW_SEC * sampleRate);
  const regionStart = Math.max(0, centerSample - searchSamples);
  const regionEnd = Math.min(samples.length, centerSample + searchSamples);
  const region = samples.subarray(regionStart, regionEnd);

  const rms = computeRMS(region, windowSize);
  if (rms.length < 4) return candidateSec;

  const onset = new Float32Array(rms.length);
  for (let i = 1; i < rms.length; i++) {
    const d = rms[i] - rms[i - 1];
    onset[i] = d > 0 ? d : 0;
  }

  let bestIdx = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < onset.length; i++) {
    if (onset[i] > bestVal) {
      bestVal = onset[i];
      bestIdx = i;
    }
  }
  if (bestIdx < 0 || bestVal <= 0) return candidateSec;

  const hitSampleAbs = regionStart + bestIdx * windowSize;
  const hitSec = hitSampleAbs / sampleRate - trimStart;
  return Math.max(0.5, Math.min(contentDur - 0.1, hitSec));
}

async function loadTracks(files: string[]): Promise<Track[]> {
  const tracks: Track[] = [];
  for (const file of files) {
    const samples = await extractPCM(file);

    // --- NEW: Calculate Peak Normalization Gain ---
    let peak = 0;
    for (let j = 0; j < samples.length; j++) {
      const abs = Math.abs(samples[j]);
      if (abs > peak) peak = abs;
    }
    // Boost the track so its loudest peak hits 0.95 (leaves a tiny bit of headroom to prevent clipping)
    const gain = peak > 0 ? 0.95 / peak : 1.0;
    // ----------------------------------------------

    const { trimStart, trimEnd } = findSilenceBounds(samples, ANALYSIS_SR);
    const contentDur = trimEnd - trimStart;
    const fadeStart = findFadeStart(samples, ANALYSIS_SR, trimStart, trimEnd);
    const randomCut = pickRandomCut(contentDur);
    const rawCut = Math.min(fadeStart, randomCut);
    const playEnd = snapToNearestOnset(
      samples,
      ANALYSIS_SR,
      trimStart,
      rawCut,
      contentDur
    );

    // console.log(
    //   `${path.basename(file)} → gain ${gain.toFixed(2)}x, trim ${trimStart.toFixed(2)}s–${trimEnd.toFixed(2)}s, ` +
    //     `raw-cut ${rawCut.toFixed(2)}s, snapped-to-beat ${playEnd.toFixed(2)}s`
    // );
    tracks.push({ file, trimStart, trimEnd, playEnd, gain }); // pass gain here
  }
  return tracks;
}
interface TransitionVoiceWindow {
  start: number;
  end: number;
}

async function createDJMix(
  tracks: Track[],
  output: string
): Promise<TransitionVoiceWindow[]> {
  const transitionSfxFiles = getSfxFiles().filter(isTransitionSfx);
  const transitionMetas = await loadTransitionSfxMeta(transitionSfxFiles);

  // NEW: trim silence off the outro the same way tracks are trimmed
  const outroPath = getDJMixOutroSongPath();
  let outroTrim: { trimStart: number; trimEnd: number } | null = null;
  if (fs.existsSync(outroPath)) {
    const outroSamples = await extractPCM(outroPath);
    outroTrim = findSilenceBounds(outroSamples, ANALYSIS_SR);
  }

  return new Promise((resolve, reject) => {
    if (tracks.length < 2) {
      reject(new Error("Need at least 2 songs"));
      return;
    }

    const command = ffmpeg();
    tracks.forEach((t) => command.input(t.file));

    // Assign one transition voice line to every track that's about to hand
    // off to the next one (i.e. every track except the last — the last
    // track fades to silence instead of transitioning). Each assigned line
    // gets added as its own ffmpeg input, indexed right after the tracks.
    let nextInputIndex = tracks.length;
    const recentTransitionSfx: string[] = [];
    const transitionVoiceForTrack = new Map<
      number,
      {
        inputIndex: number;
        file: string;
        duration: number;
        delaySec?: number;
        voiceDur?: number;
      }
    >();

    if (transitionMetas.length > 0) {
      tracks.forEach((t, i) => {
        const isLast = i === tracks.length - 1;
        if (isLast) return; // no hand-off after the final track

        const candidates = transitionMetas.filter(
          (m) => !recentTransitionSfx.includes(m.file)
        );
        const pool = candidates.length ? candidates : transitionMetas;
        const chosen = pool[Math.floor(Math.random() * pool.length)];

        recentTransitionSfx.push(chosen.file);
        if (
          recentTransitionSfx.length > TRANSITION_SFX_MAX_REPEAT_HISTORY_LENGTH
        ) {
          recentTransitionSfx.shift();
        }

        command.input(chosen.file);
        transitionVoiceForTrack.set(i, {
          inputIndex: nextInputIndex,
          file: chosen.file,
          duration: chosen.duration,
        });
        nextInputIndex++;
      });
    }

    let outroInputIndex: number | null = null;
    if (outroTrim) {
      command.input(outroPath);
      outroInputIndex = nextInputIndex;
      nextInputIndex++;
    }

    const filters: string[] = [];
    let uid = 0;
    const label = (base: string) => `${base}${uid++}`;

    function buildChunkLengths(): number[] {
      const lens: number[] = [];
      for (let i = 0; i < REPEATS; i++) {
        const t = i / (REPEATS - 1);
        lens.push(MAX_CHUNK_SEC * Math.pow(MIN_CHUNK_SEC / MAX_CHUNK_SEC, t));
      }
      return lens;
    }
    function buildVolumeRamp(): number[] {
      const vols: number[] = [];
      for (let i = 0; i < REPEATS; i++) {
        const t = i / (REPEATS - 1);

        // Logarithmic volume fade (linear in dB)
        vols.push(
          REPEAT_VOLUME_START *
            Math.pow(REPEAT_VOLUME_END / REPEAT_VOLUME_START, t)
        );
      }
      return vols;
    }
    const chunkLens = buildChunkLengths();
    const chunkVols = buildVolumeRamp();

    tracks.forEach((t, i) => {
      filters.push(
        `[${i}:a]atrim=start=${t.trimStart.toFixed(3)}:end=${t.trimEnd.toFixed(
          3
        )},asetpts=PTS-STARTPTS,volume=${t.gain.toFixed(3)},aformat=sample_rates=48000:channel_layouts=stereo[trim_${i}]`
      );
    });

    const finalLabels: string[] = [];
    const overlapDurs: number[] = [];

    tracks.forEach((t, i) => {
      const isLast = i === tracks.length - 1;

      const copies = REPEATS + 1;
      const splitLabels = Array.from({ length: copies }, () => label("split"));
      filters.push(
        `[trim_${i}]asplit=${copies}${splitLabels.map((l) => `[${l}]`).join("")}`
      );
      const [bodySrc, ...chunkSrcs] = splitLabels;

      const anchor = t.playEnd;
      const safeMax = Math.min(MAX_CHUNK_SEC, anchor * 0.5);
      const bodyDur = anchor - safeMax;

      const body = label("body");
      const voiceInfo = transitionVoiceForTrack.get(i);

      if (voiceInfo) {
        // Play the transition voice line so it ends exactly when the body
        // ends — right before the repeat/stutter phase kicks in — and duck
        // the track underneath it so the line reads clearly.
        const voiceDur = Math.min(voiceInfo.duration, bodyDur);
        const delaySec = Math.max(0, bodyDur - voiceDur);
        const delayMs = Math.floor(delaySec * 1000);

        const bodyRaw = label("bodyraw");
        filters.push(
          `[${bodySrc}]atrim=0:${bodyDur.toFixed(3)},asetpts=PTS-STARTPTS[${bodyRaw}]`
        );

        const duckExpr = buildDuckExpr(
          delaySec,
          delaySec + voiceDur,
          TRANSITION_DUCK_VOLUME,
          TRANSITION_DUCK_ATTACK_SEC,
          TRANSITION_DUCK_RELEASE_SEC
        );
        const bodyDucked = label("bodyducked");
        filters.push(
          `[${bodyRaw}]volume='${duckExpr}':eval=frame[${bodyDucked}]`
        );

        const voiceTrimmed = label("transvoice_trim");
        filters.push(
          `[${voiceInfo.inputIndex}:a]atrim=0:${voiceDur.toFixed(3)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${voiceTrimmed}]`
        );
        const voiceDelayed = label("transvoice_delay");
        filters.push(
          `[${voiceTrimmed}]adelay=${delayMs}|${delayMs}[${voiceDelayed}]`
        );

        filters.push(
          `[${bodyDucked}][${voiceDelayed}]amix=inputs=2:normalize=0:duration=first[${body}]`
        );

        // Stash the local (within-body) timing so we can translate it into
        // an absolute position in the final mix once all offsets are known.
        transitionVoiceForTrack.set(i, { ...voiceInfo, delaySec, voiceDur });

        // console.log(
        //   `${path.basename(t.file)} → transition voice "${path.basename(
        //     voiceInfo.file
        //   )}" starts at ${delaySec.toFixed(2)}s into body, ending right at the repeat phase`
        // );
      } else {
        filters.push(
          `[${bodySrc}]atrim=0:${bodyDur.toFixed(3)},asetpts=PTS-STARTPTS[${body}]`
        );
      }

      const parts = [body];

      let fadeOverlapDuration = 0;
      const thresholdIndex = Math.floor(REPEATS / 4); // Calculate the midway point of the stutters

      chunkLens.forEach((rawLen, idx) => {
        const len = Math.min(rawLen, safeMax);

        // Only accumulate duration for the second half of the stutters
        if (idx >= thresholdIndex) {
          fadeOverlapDuration += len;
        }

        const start = Math.max(0, anchor - len);
        const raw = label("chunkraw");
        const vol = label("chunkvol");
        filters.push(
          `[${chunkSrcs[idx]}]atrim=${start.toFixed(3)}:${anchor.toFixed(
            3
          )},asetpts=PTS-STARTPTS[${raw}]`
        );

        // If it's the last track, we force the volume ramp to end at 0.0 (silence)
        // If it's the last track, override the volume ramp to fade to near-silence (0.01)
        let currentVol = chunkVols[idx];
        if (isLast && !outroTrim) {
          const t_vol = idx / (REPEATS - 1);
          currentVol =
            REPEAT_VOLUME_START * Math.pow(0.01 / REPEAT_VOLUME_START, t_vol);
        }

        filters.push(`[${raw}]volume=${currentVol.toFixed(3)}[${vol}]`);
        parts.push(vol);
      });

      // Store ONLY the duration of the second half
      overlapDurs.push(fadeOverlapDuration);

      const assembled = label("assembled");
      filters.push(
        `${parts.map((p) => `[${p}]`).join("")}concat=n=${parts.length}:v=0:a=1[${assembled}]`
      );
      finalLabels.push(assembled);
    });

    if (outroTrim && outroInputIndex !== null) {
      const outroLabel = label("outro");
      filters.push(
        `[${outroInputIndex}:a]atrim=start=${outroTrim.trimStart.toFixed(
          3
        )}:end=${outroTrim.trimEnd.toFixed(
          3
        )},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo[${outroLabel}]`
      );
      finalLabels.push(outroLabel);
    }

    // Translate each track's local transition-voice timing into an
    // absolute position within the final mixed-down output, so callers can
    // avoid stacking another voice SFX on top of it later. Tracks are
    // stitched together with acrossfade, so each track's assembled segment
    // starts `overlap` seconds before the previous one ends.
    const assembledDurs = tracks.map((t) => {
      const anchor = t.playEnd;
      const safeMax = Math.min(MAX_CHUNK_SEC, anchor * 0.5);
      const bodyDur = anchor - safeMax;
      const chunkTotal = chunkLens.reduce(
        (sum, len) => sum + Math.min(len, safeMax),
        0
      );
      return bodyDur + chunkTotal;
    });

    const trackOffsets: number[] = [0];
    for (let i = 1; i < tracks.length; i++) {
      const overlap = Math.max(CLICK_GUARD_SEC, overlapDurs[i - 1]);
      trackOffsets.push(trackOffsets[i - 1] + assembledDurs[i - 1] - overlap);
    }

    const transitionVoiceWindows: TransitionVoiceWindow[] = [];
    transitionVoiceForTrack.forEach((info, i) => {
      if (info.delaySec === undefined || info.voiceDur === undefined) return;
      const absStart = trackOffsets[i] + info.delaySec;
      transitionVoiceWindows.push({
        start: absStart,
        end: absStart + info.voiceDur,
      });
    });

    let previous = finalLabels[0];
    for (let i = 1; i < finalLabels.length; i++) {
      const outLbl = i === finalLabels.length - 1 ? "out" : label("mix");

      // We pull the delayed overlap calculated for the outgoing track
      const overlap = Math.max(CLICK_GUARD_SEC, overlapDurs[i - 1]);

      // c2=tri creates the linear 0 -> 1 fade that perfectly mirrors your linear 1.0 -> 0.2 decay
      filters.push(
        `[${previous}][${finalLabels[i]}]acrossfade=d=${overlap.toFixed(3)}:c1=nofade:c2=tri[${outLbl}]`
      );
      previous = outLbl;
    }

    // console.log(
    //   `FFmpeg filtergraph (${filters.length} filters, ~${
    //     filters.join(";").length
    //   } chars — written to a script file to avoid CLI length limits)`
    // );

    const filterScriptPath = writeFilterScript(filters, "djmix_filtergraph");

    const options: string[] = [
      "-filter_complex_script",
      filterScriptPath,
      "-map",
      "[out]",
      "-ar",
      "48000",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
    ];

    command
      .outputOptions(...options)

      .on("start", (cmd) => {
        // console.log("\nFFmpeg command:\n", cmd)
      })
      .on("stderr", (line) => {
        // console.log(line)
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        cleanupFilterScript(filterScriptPath);
        reject(err);
      })
      .on("end", () => {
        // console.log("\nDJ mix created:", output);
        cleanupFilterScript(filterScriptPath);
        resolve(transitionVoiceWindows);
      })
      .save(output);
  });
}

export function getDJMixPlaceholderSongPath(): string {
  return path.join(DJ_ASSETS_DIR, "djb_placeholder.mp3");
}

function getDJMixIntroSongPath(): string {
  return path.join(DJ_ASSETS_DIR, "djb_intro.mp3");
}

async function prependIntroToMix(mixPath: string): Promise<void> {
  const introPath = getDJMixIntroSongPath();
  if (!fs.existsSync(introPath)) {
    console.log("No DJ mix intro found, skipping prepend.");
    return;
  }

  const tempOutput = mixPath.replace(/\.mp3$/, "_with_intro.mp3");

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(introPath)
      .input(mixPath)
      .complexFilter([
        "[0:a]aformat=sample_rates=48000:channel_layouts=stereo[intro0]",
        "[1:a]aformat=sample_rates=48000:channel_layouts=stereo[mix0]",
        "[intro0][mix0]concat=n=2:v=0:a=1[out]",
      ])
      .outputOptions([
        "-map",
        "[out]",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-codec:a",
        "libmp3lame",
        "-q:a",
        "2",
      ])
      .on("stderr", (line) => {
        // console.log(line)
      })
      .on("error", (err) => reject(err))
      .on("end", () => resolve())
      .save(tempOutput);
  });

  // Replace the original mix file with the intro-prefixed version.
  await new Promise<void>((resolve, reject) => {
    fs.rename(tempOutput, mixPath, (err) => (err ? reject(err) : resolve()));
  });
}

function getDJMixOutroSongPath(): string {
  return path.join(DJ_ASSETS_DIR, "djb_outro.mp3");
}

export async function generateDJMix(
  djMixMode: DjMixMode,
  token: number
): Promise<DjMixGenerationResultStatus> {
  try {
    if (token !== djMixGenerationToken) return "cancelled";

    if (!fs.existsSync(DJ_TEMP_DIR))
      throw new Error("temp folder does not exist");

    const files = getAudioFiles();
    const tracks = await loadTracks(files);

    if (token !== djMixGenerationToken) return "cancelled";

    const transitionVoiceWindows = await createDJMix(tracks, DJ_OUTPUT);
    if (token !== djMixGenerationToken) return "cancelled";

    if (djMixMode === "SFX") {
      await addRandomSfx(
        DJ_OUTPUT,
        DJ_OUTPUT_WITH_SFX,
        SFX_INTERVAL, // every 10 seconds
        transitionVoiceWindows
      );
      if (token !== djMixGenerationToken) return "cancelled";
    }

    const outputPath = djMixMode === "SFX" ? DJ_OUTPUT_WITH_SFX : DJ_OUTPUT;
    await prependIntroToMix(outputPath);
    if (token !== djMixGenerationToken) return "cancelled";
    return "success";
  } catch (error) {
    console.log(error);
    return "failure";
  }
}

function cleanUpPreviousTracks() {
  if (!fs.existsSync(DJ_TEMP_DIR)) {
    fs.mkdirSync(DJ_TEMP_DIR, { recursive: true });
    return;
  }
  const stale = fs
    .readdirSync(DJ_TEMP_DIR)
    .filter(
      (f) =>
        (f.endsWith(".mp3") || f.endsWith(".ogg")) &&
        f !== "dj_mix.mp3" &&
        f !== "dj_mix_with_sfx.mp3"
    );
  for (const f of stale) {
    fs.unlinkSync(path.join(DJ_TEMP_DIR, f));
  }
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function parseDurationToSeconds(
  text: string | undefined | null
): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!/^\d{1,2}(:\d{2}){1,2}$/.test(trimmed)) return null;

  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return null;
}

function extractDurationText(view: any): string | undefined {
  const overlays = view?.content_image?.overlays ?? [];

  for (const overlay of overlays) {
    const badges = overlay?.badges ?? [];
    for (const badge of badges) {
      const text = badge?.text;
      if (
        typeof text === "string" &&
        /^\d{1,2}(:\d{2}){1,2}$/.test(text.trim())
      ) {
        return text.trim();
      }
    }
  }

  return undefined;
}

const getSongsForMood = async (mood: string): Promise<string[]> => {
  try {
    const ytAgent = await getInnertubeAgent();
    const search = await ytAgent.search(mood + "music", { type: "playlist" });

    const playlistIds = search.playlists
      .filter((result) => result.is(YTNodes.LockupView))
      .map((view) => view.content_id)
      .splice(0, MAX_PLAYLISTS_TO_USE);

    if (playlistIds.length === 0) {
      console.log("No playlists found for mood: " + mood);
      return [];
    }

    const mergedVideos = new Set<YTNodes.LockupView>();
    for (const playlistId of playlistIds) {
      const playlist = await ytAgent.getPlaylist(playlistId);
      for (const video of playlist.videos) {
        if (video.is(YTNodes.LockupView)) mergedVideos.add(video);
      }
    }

    // filter out any video which duration is less than MIN_VIDEO_DURATION_SEC or greater than MAX_VIDEO_DURATION_SEC
    const videos = Array.from(mergedVideos).filter((video) => {
      if (!video.is(YTNodes.LockupView)) return false;
      const view = video.as(YTNodes.LockupView);

      const durationText = extractDurationText(view);
      const seconds = parseDurationToSeconds(durationText);

      if (seconds === null) return false; // couldn't determine duration → exclude
      return (
        seconds >= MIN_VIDEO_DURATION_SEC && seconds <= MAX_VIDEO_DURATION_SEC
      );
    });

    // const shuffledVideos = shuffle(videos).slice(0, MAX_PLAYLIST_SONGS);
    const finalVideos = shuffle(videos.slice(0, MAX_PLAYLIST_SONGS * 2)).splice(
      0,
      MAX_PLAYLIST_SONGS
    );

    let songUrls: string[] = [];

    for (const video of finalVideos) {
      if (video.type == "LockupView") {
        const view = video.as(YTNodes.LockupView);

        songUrls.push(`https://www.youtube.com/watch?v=${view.content_id}`);
      }
    }

    return songUrls;
  } catch (error) {
    console.log(error);
    return [];
  }
};

let currentDownloadProcess: TinyspawnPromise = null;

function killCurrentDownloadProcess() {
  if (currentDownloadProcess) {
    exec(`taskkill /pid ${currentDownloadProcess.pid} /T /F`, () => {});
    currentDownloadProcess = null;
  }
}

// Bumped every time a new DJ mix generation starts, and on explicit
// cancellation. Each in-flight downloadSongsForDJMix run captures its own
// token and re-checks it after every await — a mismatch means a newer run
// (or a skip) superseded it, so it should stop touching shared state.
let djMixGenerationToken = 0;

export function cancelDJMixGeneration() {
  djMixGenerationToken++;
  killCurrentDownloadProcess();
}

async function downloadSingleTrack(
  url: string,
  destPath: string,
  token: number
): Promise<boolean> {
  try {
    const youtubeDl = createYtDlExec(process.env.YOUTUBE_DL_DIR_EXE);
    console.log(`Downloading track: ${url} → ${destPath}`);

    const proc = youtubeDl.exec(
      url,
      {
        format: "bestaudio/best",
        extractAudio: true,
        audioFormat: "mp3",
        audioQuality: 0, // best
        ffmpegLocation: process.env.FFMPEG_PATH,
        output: destPath,
        userAgent: "googlebot",
        addHeader: ["referer:youtube.com"],
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        cookies: path.join(
          (process as any).pkg ? path.dirname(process.execPath) : __dirname,
          process.env.YOUTUBE_DL_COOKIE
        ),
      },
      { shell: false }
    );

    proc.catch((err) => {
      // console.log(`playDjMix.ts, single track:`, err);
    });

    currentDownloadProcess = proc;
    await proc;
    currentDownloadProcess = null;

    if (token !== djMixGenerationToken) return false;

    return fs.existsSync(destPath);
  } catch (error) {
    currentDownloadProcess = null;
    if (token === djMixGenerationToken) {
      console.log(`Failed to download track: ${url}`, error);
    } else {
      // console.log("Some other error:", error);
    }
    return false;
  }
}

type DjMixGenerationResultStatus = "success" | "failure" | "cancelled";

interface DjMixGenerationResult {
  status: DjMixGenerationResultStatus;
  token: number;
}

export const downloadSongsForDJMix = async (
  mood: string
): Promise<DjMixGenerationResult> => {
  djMixGenerationToken++;
  const token = djMixGenerationToken;
  try {
    cleanUpPreviousTracks();

    const songUrls = await getSongsForMood(mood);
    if (token !== djMixGenerationToken) return { status: "cancelled", token };

    if (!songUrls || songUrls.length < 3) {
      console.log("Not enough songs found for mood: " + mood);
      return { status: "failure", token };
    }

    let successCount = 0;

    console.log(
      `Starting download of ${songUrls.length} tracks for mood: ${mood}`
    );
    console.log(songUrls);

    // Sequential on purpose
    for (let i = 0; i < songUrls.length; i++) {
      if (token !== djMixGenerationToken) return { status: "cancelled", token };
      const destPath = path.join(DJ_TEMP_DIR, `track_${i}.mp3`);
      const ok = await downloadSingleTrack(songUrls[i], destPath, token);
      if (ok) successCount++;
    }

    if (token !== djMixGenerationToken) return { status: "cancelled", token };

    // createDJMix() requires at least 3 tracks to build a mix.
    if (successCount < 3) {
      console.log(
        `Only ${successCount} track(s) downloaded successfully, need at least 3.`
      );
      return { status: "failure", token };
    }

    return { status: "success", token };
  } catch (error) {
    console.log(error);
    return { status: "failure", token };
  }
};

export const executePlayDjMix = async (
  client: Client,
  member: GuildMember,
  mood: string,
  useSfx: boolean,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const song: Song = {
      title: `DJ Mix - ${mood}`,
      url: useSfx === false ? DJ_OUTPUT : DJ_OUTPUT_WITH_SFX,
      thumbnail_url: process.env.DJ_THUMBNAIL_URL,
      duration: -1,
      seek: 0,
      isYoutubeBased: false,
      isFile: true,
      djMixMode: useSfx === false ? "No SFX" : "SFX",
      isLive: false,
    };
    executePlaySong(
      client,
      member,
      null,
      songQueue,
      audioPlayer,
      sendReplyFunction,
      song
    );
  } catch (error) {
    console.log(error);
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("Failed to play DJ Mix")
          .setDescription(
            "An error occurred while trying to play the DJ Mix. Please try again later."
          )
          .setColor("DarkRed"),
      ],
    });
  }
};
