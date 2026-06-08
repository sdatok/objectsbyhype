/**
 * Sanity-check game caps and map dimensions stay aligned across server + client.
 * Run: npx tsx scripts/verify-game-caps.ts
 */
import { SURVIVOR_MAX_PLAYERS, LUNA_MAX_PLAYERS, WORLD_SIZE } from "../game-server/src/constants";
import { RED_LIGHT_MAX_PLAYERS, RLGL_TRACK_LENGTH, RLGL_TRACK_WIDTH } from "../game-server/src/red-light-constants";
import {
  RLGL_TRACK_LENGTH as CLIENT_RLGL_LEN,
  RLGL_TRACK_WIDTH as CLIENT_RLGL_W,
} from "../lib/red-light-game-constants";

const failures: string[] = [];

function expect(label: string, ok: boolean) {
  if (!ok) failures.push(label);
}

expect("Survivor max players default is 100", SURVIVOR_MAX_PLAYERS === 100);
expect("Luna max players default is 100", LUNA_MAX_PLAYERS === 100);
expect("Red Light max players default is 100", RED_LIGHT_MAX_PLAYERS === 100);
expect("Survivor world size scaled to 4000", WORLD_SIZE === 4000);
expect("Red Light track length server/client match", RLGL_TRACK_LENGTH === CLIENT_RLGL_LEN);
expect("Red Light track width server/client match", RLGL_TRACK_WIDTH === CLIENT_RLGL_W);

if (failures.length) {
  console.error("FAILED:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("OK — all games capped at 100, maps scaled:");
console.log(`  Survivor/Luna world: ${WORLD_SIZE}x${WORLD_SIZE}`);
console.log(`  Red Light track: ${RLGL_TRACK_WIDTH}x${RLGL_TRACK_LENGTH}`);
