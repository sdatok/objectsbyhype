export const BLACKJACK_CONFIG_ID = "default";
export const BLACKJACK_DEFAULT_ROUND_SECONDS = 120;

import {
  BLACKJACK_TABLE_SEATS,
  IM_DAILY_GRANT,
  IM_MAX_BET,
  IM_MILESTONE_GIVEAWAY,
  IM_MILESTONE_WOH,
  IM_MIN_BET,
} from "@/lib/blackjack-economy";

export {
  BLACKJACK_TABLE_SEATS,
  IM_DAILY_GRANT,
  IM_MAX_BET,
  IM_MILESTONE_GIVEAWAY,
  IM_MILESTONE_WOH,
  IM_MIN_BET,
};

export interface PublicBlackjackHandResult {
  outcomes: string[];
  netChange: number;
  payout: number;
}

/** Your full seat state including dealer hand and wallet info. */
export interface PublicBlackjackMySeat {
  seatIndex: number;
  stackCredits: number;
  savedCredits: number;
  currentBet: number;
  handPhase: "IDLE" | "PLAYING" | "SETTLED";
  playerCards: { rank: number; suit: number }[];
  dealerCards: { rank: number; suit: number }[];
  dealerHidden: boolean;
  handValue: number;
  activeHandIndex: number;
  handCount: number;
  finished: boolean;
  lastResult: PublicBlackjackHandResult | null;
  pendingGwCode: string | null;
  pendingWohCode: string | null;
  canPlayToday: boolean;
  nextGrantAt: string | null;
  missedRounds: number;
  inactiveKick: number;
}

/** Another player visible at the table. */
export interface PublicBlackjackSeatPlayer {
  seatIndex: number;
  displayName: string;
  email: string;
  stackCredits: number;
  handPhase: string;
  playerCards: { rank: number; suit: number }[];
  handValue: number;
  finished: boolean;
  isViewer: boolean;
}

export interface PublicBlackjackLeaderboardEntry {
  rank: number;
  displayName: string;
  email: string;
  peakStack: number;
  savedCredits: number;
}

export interface PublicBlackjackChatMessage {
  id: string;
  displayName: string;
  body: string;
  createdAt: string;
  isViewer: boolean;
}

export interface PublicBlackjackState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  roundSeconds: number;
  tableSeats: number;
  imDailyGrant: number;
  imMilestoneGiveaway: number;
  imMilestoneWoh: number;
  imMinBet: number;
  imMaxBet: number;
  inactiveKick: number;
  currentRound: {
    id: string;
    status: string;
    startedAt: string;
    endsAt: string;
    secondsRemaining: number;
    seatedCount: number;
  } | null;
  seats: Array<PublicBlackjackSeatPlayer | null>;
  mySeat: PublicBlackjackMySeat | null;
  leaderboard: PublicBlackjackLeaderboardEntry[];
}
