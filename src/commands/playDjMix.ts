import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executePlayDjMix } from "../functions/playDjMix";
import { Command } from "../interfaces/command";

export const PlayDjMixCommand: Command = {
  name: "dj",
  description:
    "Butler Bot, aka DJ B, plays a DJ mix for you based on your mood.",
  run: async (client: Client, interaction: ChatInputCommandInteraction) => {
    executePlayDjMix(client, async (options) => {
      return await sendInteractionReply(
        interaction,
        options as InteractionReplyOptions
      );
    });
  },
};
