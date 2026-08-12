import { padRows, type ScreenDef } from '../types';

/**
 * Online is shown disabled rather than hidden. The mode select's whole
 * statement is that both modes exist; concealing one misstates it, and a
 * player who has heard the game will be online-capable should see where it
 * is going rather than wonder whether they misremembered.
 */
export function home(): ScreenDef {
  return {
    title: 'Departures',
    sub: 'CHOOSE A MODE',
    back: null,
    cols: ['Mode', 'Where', 'Select', 'Players', 'Notes'],
    rows: padRows([
      {
        label: 'Mode 01', status: 'Local', text: 'PASS AND PLAY',
        amount: '2-6', showDollar: false, right: 'One device',
        chip: '#f5c451', tone: 'normal',
        action: { kind: 'navigate', to: 'passAndPlay' }
      },
      {
        label: 'Mode 02', status: 'Remote', text: 'PLAY ONLINE',
        amount: '2-6', showDollar: false, right: 'Soon',
        chip: '#2f7fe8', tone: 'disabled',
        action: null
      }
    ])
  };
}
