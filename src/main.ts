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
import { spawn, spawnSync } from "child_process";
import * as fs from "fs";
import { Innertube, Log } from "youtubei.js";
import { AIChatManager } from "./AI/AIChatManager";
import connectDB, { startBotLockHeartbeat } from "./database/connectDB";

// @ts-ignore

const agent = JSON.parse(
  fs.readFileSync(__dirname + "/../.data/yt-dlp.json", "utf8")
);

export const ytdlAgent = ytdl.createAgent(agent);

Log.setLevel(Log.Level.ERROR);

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
  new Promise<void>((resolve, reject) => {
    console.log("\nUpdating yt-dlp...");
    const child = spawn(binaryPath, ["--update-to", "nightly"], {
      shell: false,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      reject(err);
      console.log(err);
      process.exit(1);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        console.log("Result: yt-dlp was updated successfully.");
        return;
      }
      reject(new Error(`Result: yt-dlp exited with code ${code}`));
      process.exit(1);
    });
  });

async function ensureDenoInstalled(): Promise<void> {
  console.log("Checking if Deno is installed...");
  const check = spawnSync("deno", ["--version"], {
    stdio: "ignore",
  });

  if (check.status === 0) {
    console.log("Deno is already installed.");
    return;
  }

  console.log("Deno not found. Installing...");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell",
      ["irm https://deno.land/install.ps1 | iex"],
      {
        stdio: "inherit",
      }
    );

    child.on("error", (err) => {
      reject(err);
      console.log(err);
      process.exit(1);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("Result: Deno installed successfully.");
        resolve();
      } else {
        reject(new Error(`Result: Deno installer exited with code ${code}`));
        process.exit(1);
      }
    });
  });
}

const main = async () => {
  try {
    await ensureDenoInstalled();
    await updateYoutubeDl(process.env.YOUTUBE_DL_DIR_EXE);
    await connectDB();
    await startBotLockHeartbeat();
    await AIChatManagerInstance.logHealthStatus();
    console.log("Establishing Butler Bot's listeners...");
    establishListeners(client, songQueue, audioPlayer, AIChatManagerInstance);
    console.log("Butler Bot is starting...");
    await client.login(TOKEN);
  } catch (error) {
    console.log(error);
  }
};

main();
