import { AudioPlayer } from "@discordjs/voice";
import {
  channelMention,
  Client,
  Message,
  MessageCreateOptions,
  subtext,
  TextChannel,
} from "discord.js";
import { BUTLER_BOT_CHANNEL_NAME, PREFIX } from "../config";
import { executeAddSong } from "../functions/addSong";
import { executeFindLolMatch } from "../functions/findActiveLolMatch";
import { executeFindLolPlayer } from "../functions/findLolPlayer";
import { executeHello } from "../functions/hello";
import { executeLoopSong } from "../functions/loopSong";
import { executePlaySong } from "../functions/playSong";
import { executeSkipSong } from "../functions/skipSong";
import { executeStopSong } from "../functions/stopSong";
import { executeRemoveSong } from "../functions/removeSong";
import { SongQueue } from "../interfaces/song";
import { executeSeekSongTime } from "../functions/seekSongTime";
import { executeAddToFavorites } from "../functions/addToFavorites";
import { executeViewFavorites } from "../functions/viewFavorites";
import { executePlayFavorites } from "../functions/playFavorites";
import {
  executeSearchSong,
  SEARCH_DEFAULT_NUMBER_OF_RESULTS,
} from "../functions/searchSong";
import { executeSuggestSong } from "../functions/suggestSong";
import { executeViewQueue } from "../functions/viewQueue";
import { executeRemoveQueue } from "../functions/removeQueue";
import { executeAddToPlaylist } from "../functions/addToPlaylist";
import { executeViewPlaylist } from "../functions/viewPlaylist";
import { executeViewPlaylistAll } from "../functions/viewPlaylistAll";
import { executePlayPlaylist } from "../functions/playPlaylist";
import { executePlaySongFromFile } from "../functions/playSongFromFile";
import { AIChatManager } from "../AI/AIChatManager";
import { executeAIChatJoinConversation } from "../AI/AIChatJoinConversation";
import { executeAIChatLeaveConversation } from "../AI/AIChatLeaveConversation";
import { decode } from "he";

const handleMemes = (message: Message, sendReply: Function) => {
  if (
    !message.author.bot &&
    message.content.toLowerCase().includes("good bot") &&
    !message.content.startsWith(PREFIX)
  ) {
    sendReply({ content: ":heart:" });
    return;
  }

  if (
    !message.author.bot &&
    message.content.toLowerCase().includes("baba") &&
    !message.content.startsWith(PREFIX)
  ) {
    sendReply({ content: "boubou" });
    return;
  }

  if (message.embeds[0] && message.embeds[0].title) {
    if (
      message.embeds[0].title.toLowerCase().includes("playing") &&
      (message.embeds[0].title.toLowerCase().includes("day of night") ||
        message.embeds[0].title.toLowerCase().includes("silent hill")) &&
      !message.content.startsWith(PREFIX)
    ) {
      sendReply({
        content:
          "https://tenor.com/view/sad-emoji-sad-emoji-emoji-stare-disgust-gif-405076546600269050",
      });
    }
  }
};

export default (
  client: Client,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  AIChatManagerInstance: AIChatManager
) => {
  client.on("messageCreate", async (message: Message) => {
    const sendReply = async (options: MessageCreateOptions) => {
      const channel = message.channel as TextChannel;
      return await channel.send(options);
    };

    if (!message.author.bot && message.mentions.has(client.user)) {
      const requiredChannel = message.guild.channels.cache.find(
        (channel) => channel.name === BUTLER_BOT_CHANNEL_NAME
      );

      if (requiredChannel.id !== message.channel.id) {
        await sendReply({
          content: `Hey! Follow me to my ${channelMention(
            requiredChannel.id
          )} and we'll continue there. We don't want to bother the others in this channel!`,
        });
        return;
      }

      const waitingMessage = await sendReply({
        content: "Just a sec! I'm thinking...",
      });
      try {
        const prompt = message.content.replace(/<@!?(\d+)>/g, "").trim();
        const chat = await AIChatManagerInstance.generateChatResponse(
          message.member.user.username,
          prompt
        );
        var chatMessage = decode(chat.message);
        var cleanChatMessage = chatMessage.replace(/<\|im.*$/s, "").trim();

        await waitingMessage.edit({
          content: `${subtext("Use this Convo ID to join in:")} ${
            chat.conversationID
          }\n${cleanChatMessage}`,
        });
      } catch (error) {
        console.log(error);
        await waitingMessage.edit({
          content:
            "Whoops! An error occured and I couldn't generate a response! Try again later!",
        });
      }
      return;
    }

    handleMemes(message, sendReply);

    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    if (message.content.startsWith(PREFIX + "ai-join-convo")) {
      const args = message.content.substring(14).trim();
      executeAIChatJoinConversation(
        message.member,
        args,
        AIChatManagerInstance,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "ai-leave-convo")) {
      executeAIChatLeaveConversation(
        message.member,
        AIChatManagerInstance,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "play-faves")) {
      const args = message.content.substring(11).trim().split(/\s+/);
      const memberTag = args.filter((a) => a.startsWith("<@"))[0];
      const number = args.filter((a) => !a.startsWith("<@"))[0];
      executePlayFavorites(
        client,
        message.member,
        number,
        memberTag,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "playlist-add")) {
      // prompt would look like this: <playlist-add playlist="playlist name" song="song name/url"
      // should get them using playlist= and song=
      const args = message.content.substring(13).trim();
      const playlistMatch = args.match(/playlist=["']([^"']+)["']/);
      const songMatch = args.match(/song=["']([^"']+)["']/);
      const playlistID = playlistMatch ? playlistMatch[1] : null;
      const songID = songMatch ? songMatch[1] : null;
      executeAddToPlaylist(playlistID, songID, songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "playlist-view-all")) {
      executeViewPlaylistAll(sendReply);
    } else if (message.content.startsWith(PREFIX + "playlist-view")) {
      const args = message.content.substring(14).trim();
      executeViewPlaylist(args, sendReply);
    } else if (message.content.startsWith(PREFIX + "playlist")) {
      const args = message.content.substring(9).trim();
      executePlayPlaylist(
        client,
        message.member,
        args,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "play-file")) {
      executePlaySongFromFile(
        client,
        message.member,
        message.attachments.first(),
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "play")) {
      const args = message.content.substring(5).trim();
      executePlaySong(
        client,
        message.member,
        args,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "queue")) {
      executeViewQueue(songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "search")) {
      const args = message.content.substring(7).trim();
      const [name, max] = args.split("max=");
      var boundedMax = Number(max);
      if (isNaN(boundedMax)) {
        boundedMax = SEARCH_DEFAULT_NUMBER_OF_RESULTS;
      } else {
        boundedMax = boundedMax > 10 ? 10 : boundedMax;
        boundedMax = boundedMax < 1 ? 1 : boundedMax;
      }
      executeSearchSong(name, boundedMax, songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "suggest")) {
      sendReply({ content: "Thinking..." });
      const args = message.content.substring(8).trim();
      executeSuggestSong(args, songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "skip")) {
      executeSkipSong(
        client,
        message.member,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "add-fave")) {
      executeAddToFavorites(client, message.member, songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "add")) {
      const args = message.content.substring(4).trim();
      executeAddSong(args, songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "stop")) {
      executeStopSong(
        client,
        message.member,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "loop")) {
      executeLoopSong(songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "remove-all")) {
      executeRemoveQueue(songQueue, sendReply);
    } else if (message.content.startsWith(PREFIX + "remove")) {
      const args = message.content.substring(7).trim();
      executeRemoveSong(message.member, songQueue, args, sendReply);
    } else if (message.content.startsWith(PREFIX + "seek")) {
      const args = message.content.substring(5).trim();
      executeSeekSongTime(
        message.member,
        args,
        songQueue,
        audioPlayer,
        sendReply
      );
    } else if (message.content.startsWith(PREFIX + "faves")) {
      const args = message.content.substring(6).trim();
      executeViewFavorites(client, message.member, args, sendReply);
    } else if (message.content.startsWith(PREFIX + "summoner")) {
      const args = message.content.substring(9).trim();
      executeFindLolPlayer(args, sendReply);
    } else if (message.content.startsWith(PREFIX + "match")) {
      const args = message.content.substring(6).trim();
      executeFindLolMatch(args, sendReply);
    } else if (message.content.startsWith(PREFIX + "hello")) {
      executeHello(client, sendReply);
    }
  });
};
