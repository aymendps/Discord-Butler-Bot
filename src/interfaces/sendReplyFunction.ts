import {
  InteractionReplyOptions,
  Message,
  MessageCreateOptions,
} from "discord.js";

export type sendReplyFunction = (
  options: MessageCreateOptions | InteractionReplyOptions
) => Promise<Message>;
