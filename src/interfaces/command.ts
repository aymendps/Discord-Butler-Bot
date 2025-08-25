import { AudioPlayer } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  ChatInputApplicationCommandData,
  Client,
} from "discord.js";
import { Song, SongQueue } from "./song";
import { AIChatManager } from "../AI/AIChatManager";

export interface Command extends ChatInputApplicationCommandData {
  run: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer,
    AIChatManagerInstance: AIChatManager
  ) => void;
}
