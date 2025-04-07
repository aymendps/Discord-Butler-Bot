import {
  CommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
  ApplicationCommandOptionType,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeRemoveSong } from "../functions/removeSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const RemoveSongCommand: Command = {
  name: "remove",
  description:
    "Remove a song from the queue. If no number is provided, the last song will be removed.",
  options: [
    {
      name: "number",
      description: "Number of the song in the queue",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 1,
    },
  ],
  run: async (
    client: Client,
    interaction: CommandInteraction,
    songQueue: SongQueue
  ) => {
    executeRemoveSong(
      interaction.member as GuildMember,
      songQueue,
      interaction.options.get("number")?.value?.toString()?.trim(),
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
