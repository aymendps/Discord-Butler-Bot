import {
  EmbedBuilder,
  GuildMember,
  Client,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnection,
  AudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} from "@discordjs/voice";
import { Song, SongQueue } from "../interfaces/song";
import { executeAddSong } from "./addSong";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import play from "play-dl";
import { executeSkipSong } from "./skipSong";
import { executeAddSpecificToFavorites } from "./addToFavorites";
import { executeSeekSongTimeSecondsRaw } from "./seekSongTime";
import { PassThrough } from "stream";
import * as ffmpeg from "fluent-ffmpeg";
import * as ytdl from "@distube/ytdl-core";
import { ytdlAgent } from "../main";
import { Payload, youtubeDl } from "youtube-dl-exec";
import { SubprocessPromise } from "tinyspawn";
import { exec } from "child_process";

let currentStreamProcess: SubprocessPromise = null;

export function setCurrentStreamProcess(process: SubprocessPromise) {
  currentStreamProcess = process;
}

export function killCurrentStreamProcessPrematurely() {
  if (currentStreamProcess) {
    // currentStreamProcess.catch((err) => err);
    exec(`taskkill /pid ${currentStreamProcess.pid} /T /F`, (err) => {});
    currentStreamProcess = null;
  }
}

export const playSong = async (
  connection: VoiceConnection,
  audioPlayer: AudioPlayer,
  songQueue: SongQueue,
  currentSong: Song,
  successReply: (song: Song, remaining: number) => void,
  errorReply: () => void,
  finishReply: () => void,
  ageRestrictionReply: (song: Song) => Promise<void>,
  allowReply = true
) => {
  try {
    audioPlayer.removeAllListeners();

    if (!currentSong) {
      killCurrentStreamProcessPrematurely();
      connection.destroy();
      finishReply();
      return;
    }

    audioPlayer.on("stateChange", (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        playSong(
          connection,
          audioPlayer,
          songQueue,
          songQueue.pop(),
          successReply,
          errorReply,
          finishReply,
          ageRestrictionReply
        );
      }
    });

    audioPlayer.on("error", (error) => {
      if (
        error.message.includes("Failed to find nearest Block") &&
        currentSong.seek
      ) {
        console.log(
          `Couldn't find nearest block with seek: ${currentSong.seek}. Trying with next seek!`
        );
        currentSong.seek++;
        playSong(
          connection,
          audioPlayer,
          songQueue,
          currentSong,
          successReply,
          errorReply,
          finishReply,
          ageRestrictionReply,
          false
        );
      } else {
        console.log(error);
        errorReply();
      }
    });

    const seek = Number(currentSong.seek || 0);

    if (currentSong.url.includes("spotify")) {
      const searchForAlternative = await play.search(currentSong.title, {
        limit: 1,
      });
      currentSong.url = searchForAlternative[0].url;
      console.log("Spotify Changes: Using alternative url: " + currentSong.url);
      if (searchForAlternative[0].durationInSec) {
        console.log(
          "Spotify Changes: Updating duration from " +
            currentSong.duration +
            " to " +
            searchForAlternative[0].durationInSec
        );
        currentSong.duration = searchForAlternative[0].durationInSec;
      }
    }

    console.log("Current Song:");
    console.log(currentSong);

    const ffmpegStream = new PassThrough();
    if (!currentSong.isFile) {
      // const stream = ytdl(
      //   toPlay,
      //   currentSong.isLive
      //     ? {
      //         agent: ytdlAgent,
      //         quality: "highestaudio",
      //         highWaterMark: 1 << 25,
      //         liveBuffer: 4900,
      //       }
      //     : {
      //         agent: ytdlAgent,
      //         filter: "audioonly",
      //         quality: "highestaudio",
      //         highWaterMark: 1 << 25,
      //       }
      // );

      killCurrentStreamProcessPrematurely();

      const stream = youtubeDl.exec(currentSong.url, {
        format: "bestaudio",
        output: "-", // Send output to stdout
        userAgent: "googlebot",
        addHeader: ["referer:youtube.com"],
        exec: "--cookies-from-browser chrome", // Automatically get cookies
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
      });

      stream.catch((err) => {
        if (songQueue.justSeeked || songQueue.justSkipped) {
          songQueue.justSeeked = false;
          songQueue.justSkipped = false;
        } else {
          console.log(err);
          errorReply();
        }
      });

      setCurrentStreamProcess(stream);

      if (currentSong.isLive) {
        ffmpeg()
          .input(stream.stdout)
          .noVideo()
          .audioCodec("libopus")
          .format("opus")
          .audioChannels(2)
          .setDuration(14400)
          .on("error", (err, stdout, stderr) => {})
          .on("stderr", (stderr) => {})
          .pipe(ffmpegStream);
      } else {
        ffmpeg()
          .input(stream.stdout)
          .noVideo()
          .audioCodec("libopus")
          .format("opus")
          .audioChannels(2)
          .setStartTime(Number(seek))
          .setDuration(Number(currentSong.duration) - Number(seek))
          .on("error", (err, stdout, stderr) => {})
          .on("stderr", (stderr) => {})
          .pipe(ffmpegStream);
      }
    } else {
      ffmpeg(currentSong.url)
        .noVideo()
        .format("mp3")
        .audioChannels(2)
        .pipe(ffmpegStream)
        .on("error", (error) => {})
        .on("stderr", (stderr) => {});
    }

    const audioResource = createAudioResource(ffmpegStream);
    audioPlayer.play(audioResource);

    if (allowReply) successReply(currentSong, songQueue.length());
  } catch (error) {
    if (error.message) {
      if (error.message.includes("Sign in to confirm your age")) {
        await ageRestrictionReply(currentSong);
        playSong(
          connection,
          audioPlayer,
          songQueue,
          songQueue.pop(),
          successReply,
          errorReply,
          finishReply,
          ageRestrictionReply
        );
      }
    } else if (error.code === "ERR_SSL_WRONG_VERSION_NUMBER") {
      console.log("Handling SSL Error");
      playSong(
        connection,
        audioPlayer,
        songQueue,
        currentSong,
        successReply,
        errorReply,
        finishReply,
        ageRestrictionReply
      );
    } else {
      console.log(error);
      errorReply();
    }
  }
};

export const executePlaySong = async (
  client: Client,
  member: GuildMember,
  urlArg: string,
  songQueue: SongQueue,
  audioPlayer: AudioPlayer,
  sendReplyFunction: sendReplyFunction,
  useThisRawSongInstead: Song = null
) => {
  try {
    if (songQueue.isEmpty() && !urlArg && !useThisRawSongInstead) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("There is nothing to play!")
            .setDescription(
              "Add a song to the queue first to start playing music"
            )
            .setColor("DarkGold"),
        ],
      });
      return;
    }

    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("I can't find you, " + member.nickname)
            .setDescription(
              "You need to be in a voice channel to start playing music"
            )
            .setColor("DarkRed"),
        ],
      });
      return;
    }

    const permissions = voiceChannel.permissionsFor(client.user);

    if (!permissions.has("Connect") || !permissions.has("Speak")) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Let me in!")
            .setDescription(
              "I don't have the permissions to join and speak in your voice channel"
            )
            .setColor("DarkRed"),
        ],
      });
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    connection.subscribe(audioPlayer);

    if (urlArg) {
      await executeAddSong(urlArg, songQueue, sendReplyFunction);
    } else if (useThisRawSongInstead) {
      await executeAddSong(
        null,
        songQueue,
        sendReplyFunction,
        useThisRawSongInstead
      );
    }

    if (!songQueue.getCurrent()) {
      playSong(
        connection,
        audioPlayer,
        songQueue,
        songQueue.pop(),
        async (song, remaining) => {
          const response = await sendReplyFunction({
            embeds: [
              new EmbedBuilder()
                .setTitle("Playing " + song.title.substring(0, 240))
                .setURL(song.url)
                .setDescription(
                  "There are " +
                    remaining +
                    " other songs remaining in the queue"
                )
                .setThumbnail(song.thumbnail_url)
                .setColor("DarkGreen"),
            ],
            components:
              !song.isFile && !song.isLive
                ? [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                      new ButtonBuilder()
                        .setLabel("Open")
                        .setURL(song.url)
                        .setStyle(ButtonStyle.Link),
                      new ButtonBuilder()
                        .setCustomId("skip")
                        .setLabel("Skip")
                        .setStyle(ButtonStyle.Danger),
                      new ButtonBuilder()
                        .setCustomId("add-fave")
                        .setLabel("Add to Faves")
                        .setStyle(ButtonStyle.Primary)
                    ),
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                      new ButtonBuilder()
                        .setCustomId("seek-back-30")
                        .setLabel("< 30s")
                        .setStyle(ButtonStyle.Success),
                      new ButtonBuilder()
                        .setCustomId("seek-back-10")
                        .setLabel("< 10s")
                        .setStyle(ButtonStyle.Success),
                      new ButtonBuilder()
                        .setCustomId("seek-ford-10")
                        .setLabel("10s >")
                        .setStyle(ButtonStyle.Success),
                      new ButtonBuilder()
                        .setCustomId("seek-ford-30")
                        .setLabel("30s >")
                        .setStyle(ButtonStyle.Success)
                    ),
                  ]
                : [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                      new ButtonBuilder()
                        .setLabel("Open")
                        .setURL(song.url)
                        .setStyle(ButtonStyle.Link),
                      new ButtonBuilder()
                        .setCustomId("skip")
                        .setLabel("Skip")
                        .setStyle(ButtonStyle.Danger)
                    ),
                  ],
          });

          const collector = response.createMessageComponentCollector({
            time: song.duration ? song.duration * 1000 : 5 * 60000,
          });

          songQueue.collector = collector;

          let startTime = new Date();
          let endTime = new Date();

          collector.on("collect", async (confirmation) => {
            if (confirmation.customId === "skip") {
              if (song.title !== songQueue.getCurrent()?.title) {
                collector.stop();
                return;
              }
              await executeSkipSong(
                client,
                confirmation.member as GuildMember,
                songQueue,
                audioPlayer,
                sendReplyFunction
              );
              confirmation.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Playing " + song.title.substring(0, 240))
                    .setURL(song.url)
                    .setDescription(
                      "There are " +
                        remaining +
                        " other songs remaining in the queue"
                    )
                    .setThumbnail(song.thumbnail_url)
                    .setColor("DarkGreen"),
                ],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setLabel("Open")
                      .setURL(song.url)
                      .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                      .setCustomId("skipped")
                      .setLabel("Skipped!")
                      .setStyle(ButtonStyle.Danger)
                      .setDisabled(true)
                  ),
                ],
              });
            } else if (confirmation.customId === "add-fave") {
              confirmation.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Playing " + song.title.substring(0, 240))
                    .setURL(song.url)
                    .setDescription(
                      "There are " +
                        remaining +
                        " other songs remaining in the queue"
                    )
                    .setThumbnail(song.thumbnail_url)
                    .setColor("DarkGreen"),
                ],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setLabel("Open")
                      .setURL(song.url)
                      .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                      .setCustomId("skip")
                      .setLabel("Skip")
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId("add-fave")
                      .setLabel("Add to Faves")
                      .setStyle(ButtonStyle.Primary)
                  ),
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId("seek-back-30")
                      .setLabel("< 30s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-back-10")
                      .setLabel("< 10s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-10")
                      .setLabel("10s >")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-30")
                      .setLabel("30s >")
                      .setStyle(ButtonStyle.Success)
                  ),
                ],
              });
              await executeAddSpecificToFavorites(
                client,
                confirmation.member as GuildMember,
                song,
                sendReplyFunction
              );
            } else if (confirmation.customId.includes("seek-back")) {
              endTime = new Date();
              var timeDiff = endTime.valueOf() - startTime.valueOf();
              var timeDiffSeconds = Math.round(timeDiff / 1000);
              var songCurrentTime = song.seek + timeDiffSeconds;
              songCurrentTime -= confirmation.customId.includes("30") ? 30 : 10;
              songCurrentTime = songCurrentTime < 0 ? 0 : songCurrentTime;
              songCurrentTime =
                songCurrentTime > song.duration
                  ? song.duration - 1
                  : songCurrentTime;
              await executeSeekSongTimeSecondsRaw(
                songCurrentTime,
                songQueue,
                audioPlayer,
                sendReplyFunction
              );
              startTime = new Date();
              confirmation.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Playing " + song.title.substring(0, 240))
                    .setURL(song.url)
                    .setDescription(
                      "There are " +
                        remaining +
                        " other songs remaining in the queue"
                    )
                    .setThumbnail(song.thumbnail_url)
                    .setColor("DarkGreen"),
                ],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setLabel("Open")
                      .setURL(song.url)
                      .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                      .setCustomId("skip")
                      .setLabel("Skip")
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId("add-fave")
                      .setLabel("Add to Faves")
                      .setStyle(ButtonStyle.Primary)
                  ),
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId("seek-back-30")
                      .setLabel("< 30s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-back-10")
                      .setLabel("< 10s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-10")
                      .setLabel("10s >")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-30")
                      .setLabel("30s >")
                      .setStyle(ButtonStyle.Success)
                  ),
                ],
              });
            } else if (confirmation.customId.includes("seek-ford")) {
              endTime = new Date();
              var timeDiff = endTime.valueOf() - startTime.valueOf();
              var timeDiffSeconds = Math.round(timeDiff / 1000);
              var songCurrentTime = song.seek + timeDiffSeconds;
              songCurrentTime += confirmation.customId.includes("30") ? 30 : 10;
              songCurrentTime = songCurrentTime < 0 ? 0 : songCurrentTime;
              songCurrentTime =
                songCurrentTime > song.duration
                  ? song.duration - 1
                  : songCurrentTime;
              await executeSeekSongTimeSecondsRaw(
                songCurrentTime,
                songQueue,
                audioPlayer,
                sendReplyFunction
              );
              startTime = new Date();
              confirmation.update({
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Playing " + song.title.substring(0, 240))
                    .setURL(song.url)
                    .setDescription(
                      "There are " +
                        remaining +
                        " other songs remaining in the queue"
                    )
                    .setThumbnail(song.thumbnail_url)
                    .setColor("DarkGreen"),
                ],
                components: [
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setLabel("Open")
                      .setURL(song.url)
                      .setStyle(ButtonStyle.Link),
                    new ButtonBuilder()
                      .setCustomId("skip")
                      .setLabel("Skip")
                      .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                      .setCustomId("add-fave")
                      .setLabel("Add to Faves")
                      .setStyle(ButtonStyle.Primary)
                  ),
                  new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                      .setCustomId("seek-back-30")
                      .setLabel("< 30s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-back-10")
                      .setLabel("< 10s")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-10")
                      .setLabel("10s >")
                      .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                      .setCustomId("seek-ford-30")
                      .setLabel("30s >")
                      .setStyle(ButtonStyle.Success)
                  ),
                ],
              });
            }
          });
          collector.once("end", async () => {
            response.edit({
              embeds: [
                new EmbedBuilder()
                  .setTitle("Playing " + song.title.substring(0, 240))
                  .setURL(song.url)
                  .setDescription(
                    "There are " +
                      remaining +
                      " other songs remaining in the queue"
                  )
                  .setThumbnail(song.thumbnail_url)
                  .setColor("DarkGreen"),
              ],
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setLabel("Open")
                    .setURL(song.url)
                    .setStyle(ButtonStyle.Link),
                  new ButtonBuilder()
                    .setCustomId("finished")
                    .setLabel("Finished!")
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true)
                ),
              ],
            });
          });
        },
        () => {
          sendReplyFunction({
            embeds: [
              new EmbedBuilder()
                .setTitle("Something went wrong")
                .setDescription(
                  "Could not play the requested song.. Moving on to the next song in queue"
                )
                .setColor("DarkRed"),
            ],
          });
        },
        () => {
          sendReplyFunction({
            embeds: [
              new EmbedBuilder()
                .setTitle("I finished my job")
                .setDescription(
                  "There are no songs remaining in the queue. Feel free to request me again with new songs"
                )
                .setColor("DarkGreen"),
            ],
          });
        },
        async (song) => {
          await sendReplyFunction({
            embeds: [
              new EmbedBuilder()
                .setTitle("Oh no! Age Restricted Song!")
                .setDescription(
                  `The song ${song.title} is age restricted. Skipping to the next song...`
                )
                .setColor("DarkGold"),
            ],
          });
        }
      );
    }
  } catch (error) {
    if (error.message?.includes("Seeking beyond limit")) {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Seeking Beyond Limit!")
            .setDescription(
              "Make sure your timestamp does not exceed the length of the song!"
            )
            .setColor("DarkRed"),
        ],
      });
    } else {
      sendReplyFunction({
        embeds: [
          new EmbedBuilder()
            .setTitle("Something went wrong")
            .setDescription("Could not add or play the request song...")
            .setColor("DarkRed"),
        ],
      });
    }
  }
};
