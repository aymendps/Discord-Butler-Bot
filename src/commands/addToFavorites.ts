import {
  CommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executeAddToFavorites } from "../functions/addToFavorites";

export const AddToFavoritesCommand: Command = {
  name: "add-fave",
  description: "Add a song to your personal favorites",
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeAddToFavorites(
      client,
      interaction.member as GuildMember,
      songQueue,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
