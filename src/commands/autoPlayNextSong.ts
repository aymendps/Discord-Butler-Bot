import {
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeAutoPlayNextSong } from "../functions/autoPlayNextSong";

export const AutoPlayNextSongCommand: Command = {
  name: "autoplay",
  description:
    "Toggles autoplay mode. Butler Bot will find and play the next song when the queue is almost empty.",
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue
  ) => {
    executeAutoPlayNextSong(
      interaction.member as GuildMember,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
