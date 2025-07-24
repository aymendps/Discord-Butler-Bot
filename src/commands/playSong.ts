import { AudioPlayer } from "@discordjs/voice";
import {
  ChatInputCommandInteraction,
  Client,
  ApplicationCommandOptionType,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executePlaySong } from "../functions/playSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const PlaySongCommand: Command = {
  name: "play",
  description: "Start playing music",
  options: [
    {
      name: "url",
      description: "The URL of the song to be added",
      type: ApplicationCommandOptionType.String,
    },
  ],
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer
  ) => {
    executePlaySong(
      client,
      interaction.member as GuildMember,
      interaction.options.get("url")?.value?.toString()?.trim(),
      songQueue,
      audioPlayer,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
