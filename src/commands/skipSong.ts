import { AudioPlayer } from "@discordjs/voice";
import {
  CommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeSkipSong } from "../functions/skipSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const SkipSongCommand: Command = {
  name: "skip",
  description: "Skip a song and play the next one in the queue",
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executeSkipSong(
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
