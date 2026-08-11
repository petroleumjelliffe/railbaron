import { cityById } from './cities';
import { payoutBetween } from './payouts';
import { rollCityIn, rollRegion } from './rollTable';
import type { CityId, RegionId, Rng } from './types';

export type RollOutcome =
  | { kind: 'home'; city: CityId; region: RegionId }
  | { kind: 'arrived'; city: CityId; region: RegionId; payout: number }
  | { kind: 'chooseRegion'; rolled: RegionId };

export interface Arrival {
  city: CityId;
  region: RegionId;
  payout: number;
}

/**
 * A baron's first roll is their home town and pays nothing. After that, a
 * roll that names the region they are already in hands the choice to the
 * player instead of picking a city.
 */
export function rollDestination(from: CityId | null, rng: Rng): RollOutcome {
  const region = rollRegion(rng);

  if (from === null) {
    return { kind: 'home', city: rollCityIn(region, rng), region };
  }

  if (region === cityById(from).region) {
    return { kind: 'chooseRegion', rolled: region };
  }

  const { city, payout } = destinationInRegion(from, region, rng);
  return { kind: 'arrived', city, region, payout };
}

/** Used both for a normal roll and after the player picks a region. */
export function destinationInRegion(from: CityId, region: RegionId, rng: Rng): Arrival {
  let city = rollCityIn(region, rng);
  // Only reachable when the player chose their own region: the table can name
  // the city they are standing in, and a journey to yourself has no price.
  let guard = 0;
  while (city === from) {
    if (++guard > 100) throw new Error(`could not leave ${from} within ${region}`);
    city = rollCityIn(region, rng);
  }
  return { city, region, payout: payoutBetween(from, city) };
}
