import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeSuggestSong } from "../functions/suggestSong";

export const SuggestSongCommand: Command = {
  name: "suggest",
  description:
    "Suggests related songs based on a given song name or the currently playing song if none is provided",
  options: [
    {
      name: "name",
      description: "The name of the song to be searched",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue
  ) => {
    executeSuggestSong(
      interaction.options.get("name", false)?.value as string,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
