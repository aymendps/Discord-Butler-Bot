import {
  ChatInputCommandInteraction,
  Client,
  GuildMember,
  InteractionReplyOptions,
} from "discord.js";
import { sendInteractionReply } from ".";
import { Command } from "../interfaces/command";
import { executeAIClearChatHistory } from "../AI/AIClearChatHistory";
import { SongQueue } from "../interfaces/song";
import { AudioPlayer } from "@discordjs/voice";
import { AIChatManager } from "../AI/AIChatManager";

export const AIClearChatHistoryCommand: Command = {
  name: "ai-clear-chat",
  description: "Clear your chat history with Butler Bot's AI",
  run: async (
    client: Client,
    interaction: ChatInputCommandInteraction,
    songQueue: SongQueue,
    audioPlayer: AudioPlayer,
    AIChatManagerInstance: AIChatManager
  ) => {
    executeAIClearChatHistory(
      interaction.member as GuildMember,
      AIChatManagerInstance,
      async (options: InteractionReplyOptions) => {
        return await sendInteractionReply(interaction, options);
      }
    );
  },
};
