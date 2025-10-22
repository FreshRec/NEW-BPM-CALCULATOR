import type { Instrument, Note } from './types';

export const NOTE_NAMES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

const createNote = (nameWithOctave: string, frequency: number): Note => {
  const octave = parseInt(nameWithOctave.slice(-1));
  const name = nameWithOctave.slice(0, -1);
  return { name, octave, frequency };
};

export const TUNING_PRESETS: { [key: string]: Instrument } = {
  chromatic: {
    name: 'Хроматический',
    notes: [],
  },
  guitar: {
    name: 'Гитара (Стандарт)',
    notes: [
      createNote('E2', 82.41),
      createNote('A2', 110.00),
      createNote('D3', 146.83),
      createNote('G3', 196.00),
      createNote('B3', 246.94),
      createNote('E4', 329.63),
    ],
  },
  bass: {
    name: 'Бас-гитара (Стандарт)',
    notes: [
      createNote('E1', 41.20),
      createNote('A1', 55.00),
      createNote('D2', 73.42),
      createNote('G2', 98.00),
    ],
  },
  violin: {
    name: 'Скрипка',
    notes: [
      createNote('G3', 196.00),
      createNote('D4', 293.66),
      createNote('A4', 440.00),
      createNote('E5', 659.25),
    ],
  },
  ukulele: {
    name: 'Укулеле (Стандарт)',
    notes: [
      createNote('G4', 392.00),
      createNote('C4', 261.63),
      createNote('E4', 329.63),
      createNote('A4', 440.00),
    ],
  },
};