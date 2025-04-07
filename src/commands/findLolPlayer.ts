import {
  CommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeFindLolPlayer } from "../functions/findLolPlayer";
import { Command } from "../interfaces/command";

export const FindLolPlayerCommand: Command = {
  name: "summoner",
  description: "League of Legends: Find stats about a summoner",
  options: [
    {
      name: "summoner",
      description: "The summoner name (League of Legends)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (client: Client, interaction: CommandInteraction) => {
    executeFindLolPlayer(
      interaction.options.get("summoner").value as string,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
