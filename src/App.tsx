import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { Rng } from '../engine';
import { Board } from './board/Board';
import { home } from './board/screens/home';
import type { Row } from './board/types';

export interface AppProps {
  /** Injectable so tests can script the dice through the full ballot path. */
  rng?: Rng;
}

function HomePage() {
  const navigate = useNavigate();
  return (
    <Board
      screen={home()}
      onBack={() => {}}
      onRowAct={(row: Row) => {
        if (row.action?.kind === 'navigate' && row.action.to === 'passAndPlay') {
          navigate('/pass-and-play');
        }
      }}
    />
  );
}

export default function App(_props: AppProps = {}) {
  return (
    <main style={{ height: '100%' }}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* Renders home until Task 7 gives pass-and-play its own screen. */}
        <Route path="/pass-and-play" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
