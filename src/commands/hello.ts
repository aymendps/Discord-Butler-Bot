import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeHello } from "../functions/hello";
import { Command } from "../interfaces/command";

export const HelloCommand: Command = {
  name: "hello",
  description: "The first command ever made",
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executeHello(client, async (options: InteractionReplyOptions) => {
      return await sendInteractionReply(interaction, options);
    });
  },
};
