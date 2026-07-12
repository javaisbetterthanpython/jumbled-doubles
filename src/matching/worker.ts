import { getNextBestRound } from "./index";
import { PlayerId, Round, Team } from "./types";

addEventListener(
  "message",
  async (
    event: MessageEvent<[Round[], PlayerId[], number, PlayerId[], Team[]?]>
  ) => {
    const round = await getNextBestRound(...event.data);
    postMessage(round);
  }
);
