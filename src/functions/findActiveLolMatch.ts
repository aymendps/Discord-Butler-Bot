import axios, { AxiosResponse } from "axios";
import { EmbedBuilder } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../../.env" });
import { RIOT_TOKEN } from "../config";
import { CurrentLoLMatchDTO } from "../interfaces/currentLoLMatch.dto";
import { LolTeamDTO } from "../interfaces/LolTeam.dto";
import { sendReplyFunction } from "../interfaces/sendReplyFunction";
import { SummonerDTO } from "../interfaces/summoner.dto";

const findActiveLolMatch = async (summonerName: string) => {
  try {
    const { data: summoner }: AxiosResponse<SummonerDTO> = await axios.get(
      `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${RIOT_TOKEN}`
    );

    const { id } = summoner;

    const { data: currentMatch }: AxiosResponse<CurrentLoLMatchDTO> =
      await axios.get(
        `https://euw1.api.riotgames.com/lol/spectator/v4/active-games/by-summoner/${id}?api_key=${RIOT_TOKEN}`
      );

    let team1: LolTeamDTO = { participants: [], bannedChampions: [] };
    let team2: LolTeamDTO = { participants: [], bannedChampions: [] };

    const tempTeamId = currentMatch.participants[0].teamId;

    currentMatch.participants.forEach((p) => {
      if (tempTeamId === p.teamId) {
        team1.participants.push(p);
      } else {
        team2.participants.push(p);
      }
    });

    currentMatch.bannedChampions.forEach((c) => {
      if (tempTeamId === c.teamId) {
        team1.bannedChampions.push(c);
      } else {
        team2.bannedChampions.push(c);
      }
    });

    const patch = await axios.get(
      "https://ddragon.leagueoflegends.com/api/versions.json"
    );

    const { data } = await axios.get(
      `http://ddragon.leagueoflegends.com/cdn/${patch.data[0]}/data/en_US/champion.json`
    );

    const champions: Object = data.data;

    const getChampNames = (team: LolTeamDTO) => {
      team.bannedChampions.forEach((champion) => {
        for (const key in champions) {
          if (champions.hasOwnProperty(key)) {
            const champ = champions[key];
            if (Number(champion.championId) === Number(champ.key)) {
              champion.championName = champ.name;
            }
          }
        }
      });

      team.participants.forEach((participant) => {
        for (const key in champions) {
          if (champions.hasOwnProperty(key)) {
            const champ = champions[key];
            if (Number(participant.championId) === Number(champ.key)) {
              participant.championName = champ.name;
            }
          }
        }
      });
    };

    getChampNames(team1);
    getChampNames(team2);

    return { team1, team2 };
  } catch (error) {
    throw error;
  }
};

export const executeFindLolMatch = async (
  summonerName: string,
  sendReplyFunction: sendReplyFunction
) => {
  try {
    const { team1, team2 } = await findActiveLolMatch(summonerName);

    const teamEmbeds = (team: LolTeamDTO) => {
      return team.participants.map((p, index) => {
        return {
          name: `Player #${index + 1}`,
          value: `${p.summonerName} (${p.championName})`,
        };
      });
    };

    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(`League Of Legends - Live Game`)
          .setURL(
            `https://www.op.gg/summoners/euw/${summonerName.replace(/\s/g, "")}`
          )
          .setColor("DarkGreen")
          .addFields(
            {
              name: "Blue Team:",
              value: "\u200b",
            },
            ...teamEmbeds(team1),
            {
              name: "\u200b",
              value: "\u200b",
            },
            {
              name: "Red Team:",
              value: "\u200b",
            },
            ...teamEmbeds(team2)
          ),
      ],
    });
  } catch (error) {
    sendReplyFunction({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Summoner '${summonerName}' is not in an active game`)
          .setDescription("Try again in a few minutes..")
          .setColor("DarkGold"),
      ],
    });
    console.log(error);
  }
};
