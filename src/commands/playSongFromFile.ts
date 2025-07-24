import { AudioPlayer } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  Client,
  ApplicationCommandOptionType,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";
import { executePlaySongFromFile } from "../functions/playSongFromFile";

export const PlaySongFromFileCommand: Command = {
  name: "play-file",
  description: "Start playing a song from a file",
  options: [
    {
      name: "file",
      description: "The audio file to play",
      type: ApplicationCommandOptionType.Attachment,
      required: true,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executePlaySongFromFile(
      client,
      interaction.member as GuildMember,
      interaction.options.get("file", true).attachment,
      songQueue,
      audioPlayer,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
