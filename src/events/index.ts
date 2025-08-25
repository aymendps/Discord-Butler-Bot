import { AudioPlayer } from "@discordjs/voice";
import { Client } from "discord.js";
import { SongQueue } from "../interfaces/song";
import interactionCreate from "./interactionCreate";
import messageCreate from "./messageCreate";
import ready from "./ready";
import { AIChatManager } from "../AI/AIChatManager";

const establishListeners = (
  client: Client,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  AIChatManagerInstance: AIChatManager
) => {
  ready(client);
  interactionCreate(client, songQueue, audioPlayer, AIChatManagerInstance);
  messageCreate(client, songQueue, audioPlayer, AIChatManagerInstance);
};

export default establishListeners;
