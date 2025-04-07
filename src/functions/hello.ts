import {
  Message,
  EmbedBuilder,
  MessageCreateOptions,
  InteractionReplyOptions,
  Client,
} from "discord.js";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";

export const executeHello = (
  client: Client,
  sendReplyFunction: sendReplyFunction
) => {
  sendReplyFunction({
    embeds: [
      new EmbedBuilder()
        .setDescription("Hello world! Butler Bot is at your service!")
        .setImage(client.user.avatarURL())
        .setColor("DarkGreen"),
    ],
  });
};
