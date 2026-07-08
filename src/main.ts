import path from "path";
import * as dotenv from "dotenv";

const basePath = (process as any).pkg
  ? path.join(__dirname, "../.env.package")
  : ".env.dev";

dotenv.config({ path: basePath, quiet: true });

if ((process as any).pkg) {
  process.env.YOUTUBE_DL_DIR = path.join(
    path.dirname(process.execPath),
    process.env.YOUTUBE_DL_DIR
  );
  process.env.YOUTUBE_DL_DIR_EXE = path.join(
    path.dirname(process.execPath),
    process.env.YOUTUBE_DL_DIR_EXE
  );
  process.env.FFMPEG_PATH = path.join(
    path.dirname(process.execPath),
    process.env.FFMPEG_PATH
  );
  process.env.FFPROBE_PATH = path.join(
    path.dirname(process.execPath),
    process.env.FFPROBE_PATH
  );
}

import * as Discord from "discord.js";
import { TOKEN } from "./config";
import establishListeners from "./events";
import { SongQueue } from "./interfaces/song";
import { createAudioPlayer, NoSubscriberBehavior } from "@discordjs/voice";
import * as ytdl from "@distube/ytdl-core";
import { spawn } from "child_process";
import * as fs from "fs";
import { Innertube } from "youtubei.js";
import { AIChatManager } from "./AI/AIChatManager";
import connectDB, { startBotLockHeartbeat } from "./database/connectDB";

// @ts-ignore

const agent = JSON.parse(
  fs.readFileSync(__dirname + "/../.data/yt-dlp.json", "utf8")
);

export const ytdlAgent = ytdl.createAgent(agent);

let innertubeAgent: Innertube = null;

// read string from .data/innertube.txt
const innertubeData = fs.readFileSync(
  __dirname + "/../.data/innertube.txt",
  "utf8"
);

export async function getInnertubeAgent(): Promise<Innertube> {
  if (!innertubeAgent) {
    innertubeAgent = await Innertube.create({
      cookie: innertubeData,
    });
  }
  return innertubeAgent;
}

const client = new Discord.Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "MessageContent",
    "GuildMembers",
    "GuildVoiceStates",
    "GuildPresences",
  ],
});

const songQueue = new SongQueue();
const AIChatManagerInstance = new AIChatManager();

const audioPlayer = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play,
  },
});

const updateYoutubeDl = (binaryPath: string) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(binaryPath, ["-U"], { shell: false });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }

      reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
    });
  });

const main = async () => {
  try {
    await connectDB();
    await startBotLockHeartbeat();
    console.log("\nUpdating yt-dlp...");
    const result = await updateYoutubeDl(process.env.YOUTUBE_DL_DIR_EXE);
    console.log(result.stdout);
    console.log("Result: yt-dlp was updated successfully.\n");
    console.log("Establishing Butler Bot's listeners...");
    establishListeners(client, songQueue, audioPlayer, AIChatManagerInstance);
    console.log("Butler Bot is starting...");
    await client.login(TOKEN);
  } catch (error) {
    console.log(error);
  }
};

main();
