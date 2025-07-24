import { AudioPlayer } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  ChatInputApplicationCommandData,
  Client,
} from "discord.js";
import { Song, SongQueue } from "./song";

export interface Command extends ChatInputApplicationCommandData {
  run: (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => void;
}
