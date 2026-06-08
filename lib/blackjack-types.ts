export const BLACKJACK_CONFIG_ID = "default";
export const BLACKJACK_DEFAULT_ROUND_SECONDS = 180;
export const BLACKJACK_WHEEL_WINNERS = 10;

export interface PublicBlackjackEntry {
  id: string;
  displayName: string;
  email: string;
  playerCards: { rank: number; suit: number }[];
  dealerCards: { rank: number; suit: number }[];
  dealerHidden: boolean;
  outcome: string | null;
  handValue: number;
  placement: number | null;
  wheelCode: string | null;
  finished: boolean;
}

export interface PublicBlackjackLeader {
  placement: number;
  displayName: string;
  email: string;
  outcome: string;
  handValue: number;
  wheelCode: string | null;
}

export interface PublicBlackjackState {
  enabled: boolean;
  prizeTitle: string;
  prizeDescription: string | null;
  roundSeconds: number;
  currentRound: {
    id: string;
    status: string;
    startedAt: string;
    endsAt: string;
    secondsRemaining: number;
    entryCount: number;
  } | null;
  myEntry: PublicBlackjackEntry | null;
  lastWinners: PublicBlackjackLeader[];
  /** Most recent settled hand for this viewer (wheel code persists after round rolls). */
  recentResult: PublicBlackjackEntry | null;
}
