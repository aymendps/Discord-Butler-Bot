import { AudioPlayer } from "@discordjs/voice";
import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  GuildMember,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executePlayDjMix } from "../functions/playDjMix";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const PlayDjMixCommand: Command = {
  name: "dj",
  description:
    "Butler Bot, aka DJ B, plays a DJ mix for you based on your mood.",
  options: [
    {
      name: "mood",
      description: "The mood for the DJ mix",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "sfx",
      description: "Whether to include sound effects in the DJ mix",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executePlayDjMix(
      client,
      interaction.member as GuildMember,
      interaction.options.get("mood", true).value as string,
      interaction.options.get("sfx", false)?.value as boolean,
      songQueue,
      audioPlayer,
      async (options) => {
        return await sendInteractionReply(
          interaction,
          options as InteractionReplyOptions
        );
      }
    );
  },
};
