import { AudioPlayer } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeStopSong } from "../functions/stopSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const StopSongCommand: Command = {
  name: "stop",
  description: "Stop playing music and emtpy the queue",
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executeStopSong(
      client,
      interaction.member as GuildMember,
      songQueue,
      audioPlayer,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
