import { DeparturesBoard } from './game/DeparturesBoard';
import { useGame } from './state/useGame';

export default function App() {
  const { state, activate, chooseRegion } = useGame();
  return (
    <main style={{ height: '100%' }}>
      <DeparturesBoard state={state} onActivate={activate} onChooseRegion={chooseRegion} />
    </main>
  );
}
