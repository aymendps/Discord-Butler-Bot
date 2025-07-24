import {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { executeLoopSong } from "../functions/loopSong";
import { Command } from "../interfaces/command";
import { SongQueue } from "../interfaces/song";

export const LoopSongCommand: Command = {
  name: "loop",
  description: "Toggles loop mode. Keep playing the same song!",
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue
  ) => {
    executeLoopSong(songQueue, async (options: InteractionReplyOptions) => {
      return await sendInteractionReply(interaction, options);
    });
  },
};
