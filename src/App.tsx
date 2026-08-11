import type { Rng } from '../engine';
import { DeparturesBoard } from './game/DeparturesBoard';
import { useGame } from './state/useGame';

export interface AppProps {
  /** Injectable so tests can script the dice through the full ballot path. */
  rng?: Rng;
}

export default function App({ rng }: AppProps = {}) {
  const { state, activate, chooseRegion } = useGame(rng);
  return (
    <main style={{ height: '100%' }}>
      <DeparturesBoard state={state} onActivate={activate} onChooseRegion={chooseRegion} />
    </main>
  );
}
