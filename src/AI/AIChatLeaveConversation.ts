import { EmbedBuilder, GuildMember } from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { AIChatManager } from "./AIChatManager";

export const executeAIChatLeaveConversation = (
  member: GuildMember,
  AIChatManagerInstance: AIChatManager,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const [success, conversationID] = AIChatManagerInstance.leaveConversation(
      member.user.username
    );

    if (success) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `${member.user.username} has left conversation ${conversationID}`
            )
            .setColor("DarkGreen"),
        ],
      });
    } else {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `${member.user.username} hasn't joined a conversation yet`
            )
            .setColor("DarkOrange"),
        ],
      });
    }
  } catch (error) {
    console.log("Error leaving conversation:", error);
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `Failed to leave the current conversation. Please try again later!`
          )
          .setColor("DarkRed"),
      ],
    });
  }
};
