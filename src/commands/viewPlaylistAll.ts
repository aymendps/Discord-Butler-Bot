import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { executeViewPlaylistAll } from "../functions/viewPlaylistAll";

export const ViewPlaylistAllCommand: Command = {
  name: "playlist-view-all",
  description: "View all created playlists",
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executeViewPlaylistAll(async (options: InteractionReplyOptions) => {
      return await sendInteractionReply(interaction, options);
    });
  },
};
