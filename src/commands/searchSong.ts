import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeSearchSong } from "../functions/searchSong";

export const SearchSongCommand: Command = {
  name: "search",
  description: "Searches for songs with the given name",
  options: [
    {
      name: "name",
      description: "The name of the song to be searched",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "max",
      description: "The maximum number of results to show",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
      maxValue: 10,
    },
  ],
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeSearchSong(
      interaction.options.get("name", true).value as string,
      interaction.options.get("max", false)?.value as number,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
