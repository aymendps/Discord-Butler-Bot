import { BannedChampionDTO } from "./bannedChampion.dto";
import { CurrentLoLMatchParticipantDTO } from "./currentLolMatchParticipant.dto";

export interface LolTeamDTO {
  participants: CurrentLoLMatchParticipantDTO[];
  bannedChampions: BannedChampionDTO[];
}
