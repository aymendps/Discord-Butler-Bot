import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { executeViewPlaylist } from "../functions/viewPlaylist";

export const ViewPlaylistCommand: Command = {
  name: "playlist-view",
  description: "View the songs in the playlist with their current order",
  options: [
    {
      name: "playlist",
      description: "ID of the playlist",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executeViewPlaylist(
      interaction.options.get("playlist", true).value as string,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
