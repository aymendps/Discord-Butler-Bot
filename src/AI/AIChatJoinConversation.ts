import { EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { AIChatManager } from "./AIChatManager";

export const executeAIChatJoinConversation = (
  member: GuildMember,
  conversationID: string,
  AIChatManagerInstance: AIChatManager,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    AIChatManagerInstance.joinConversation(
      member.user.username,
      conversationID
    );
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `${member.user.username} has joined conversation ${conversationID}`
          )
          .setColor("DarkGreen"),
      ],
    });
  } catch (error) {
    console.log("Error joining conversation:", error);
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `Failed to join conversation ${conversationID}. Please try again later!`
          )
          .setColor("DarkRed"),
      ],
    });
  }
};
