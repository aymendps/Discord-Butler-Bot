import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue, SongQueueAutoPlayMode } from "../interfaces/song";
import { executeAutoPlayNextSong } from "../functions/autoPlayNextSong";

export const AutoPlayNextSongCommand: Command = {
  name: "autoplay",
  description:
    "Toggles autoplay mode. Butler Bot will find and play the next song when the queue is almost empty.",
  options: [
    {
      name: "source",
      description: "The source to use for suggesting songs",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "Youtube Music", value: "Youtube Music" },
        { name: "Youtube Normal", value: "Youtube Normal" },
        { name: "None", value: "None" },
      ],
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue
  ) => {
    executeAutoPlayNextSong(
      interaction.member as GuildMember,
      interaction.options.get("source", false)?.value as SongQueueAutoPlayMode,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
