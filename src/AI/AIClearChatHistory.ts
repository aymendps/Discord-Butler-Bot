import { EmbedBuilder, Client, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { AIChatManager } from "./AIChatManager";

export const executeAIClearChatHistory = (
  member: GuildMember,
  AIChatManagerInstance: AIChatManager,
  sendReplyFunction: sendReplyFunction
) => {
  AIChatManagerInstance.clearChatHistory(member.user.username);
  sendReplyFunction({
    embeds: [
      new EmbedBuilder()
        .setTitle("It's like it was never there!")
        .setDescription(
          `Cleared chat history for ${member.user.username}. Feel free to start a new chat with me!`
        )
        .setColor("DarkGreen"),
    ],
  });
};
