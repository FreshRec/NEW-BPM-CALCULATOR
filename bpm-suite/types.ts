export enum Tab {
  Calculator = 'Калькулятор',
  Metronome = 'Метроном',
  Tuner = 'Тюнер',
}

export interface Note {
  name: string;
  octave: number;
  frequency: number;
}

export interface Instrument {
  name: string;
  notes: Note[];
}