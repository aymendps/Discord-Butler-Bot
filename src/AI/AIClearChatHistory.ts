import { EmbedBuilder, Client, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { AIChatManager } from "./AIChatManager";

export const executeAIClearChatHistory = (
  member: GuildMember,
  AIChatManagerInstance: AIChatManager,
  sendReplyFunction: sendReplyFunction
) => {
  const didExist = AIChatManagerInstance.clearChatHistory(member.user.username);
  if (didExist) {
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
  } else {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle("No chat history found!")
          .setDescription(
            `I couldn't find any chat history for ${member.user.username}. You can start chatting with me anytime!`
          )
          .setColor("DarkGold"),
      ],
    });
  }
};
