import { AudioPlayer } from "@discordjs/voice";
import {
  Client,
  Interaction,
  CommandInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { Commands } from "../commands";
import { SongQueue } from "../interfaces/song";
import { AIChatManager } from "../AI/AIChatManager";

const handleSlashCommand = async (
  client: Client,
  interaction: CommandInteraction,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  AIChatManagerInstance: AIChatManager
) => {
  const slashCommand = Commands.find(
    (command) => command.name === interaction.commandName
  );

  if (!slashCommand) {
    console.error(
      "Command " +
        interaction.commandName +
        " was not found in available Commands"
    );
    return;
  }

  await interaction.deferReply();

  slashCommand.run(
    client,
    interaction as ChatInputCommandInteraction,
    songQueue,
    audioPlayer,
    AIChatManagerInstance
  );
};

export default (
  client: Client,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  AIChatManagerInstance: AIChatManager
) => {
  client.on("interactionCreate", async (interaction: Interaction) => {
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      await handleSlashCommand(
        client,
        interaction,
        songQueue,
        audioPlayer,
        AIChatManagerInstance
      );
    }
  });
};
