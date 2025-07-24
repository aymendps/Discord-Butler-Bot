import {
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { executeViewFavorites } from "../functions/viewFavorites";

export const ViewFavoritesCommand: Command = {
  name: "faves",
  description: "View songs that were added to your personal favorites",
  options: [
    {
      name: "member",
      description:
        "Tag another member to play from their faves. If empty by default, it plays from your faves",
      type: ApplicationCommandOptionType.String,
    },
  ],
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executeViewFavorites(
      client,
      interaction.member as GuildMember,
      interaction.options.get("member")?.value?.toString()?.trim(),
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
