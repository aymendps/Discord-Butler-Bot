import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeFindLolMatch } from "../functions/findActiveLolMatch";
import { executeFindLolPlayer } from "../functions/findLolPlayer";
import { Command } from "../interfaces/command";

export const findActiveLolMatchCommand: Command = {
  name: "match",
  description: "League of Legends: Find information about the live game",
  options: [
    {
      name: "summoner",
      description: "The summoner name (League of Legends)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executeFindLolMatch(
      interaction.options.get("summoner").value as string,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
