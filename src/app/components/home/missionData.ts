export interface MissionStep {
  emoji: string;
  text: string;
  hint?: string;
}

export interface MissionLevel {
  id: string;
  label: string;
  badge: string;
  description: string;
  timerSeconds: number;
}

export interface ChecklistItem {
  id: string;
  emoji: string;
  text: string;
}

export type MissionType = 'steps_with_levels' | 'timed_steps' | 'checklist';

export interface MissionDefinition {
  code: string;
  type: MissionType;
  heroEmoji: string;
  title: (petName: string) => string;
  subtitle: string;
  steps?: MissionStep[];
  levels?: MissionLevel[];
  defaultLevelId?: string;
  checklist?: ChecklistItem[];
  /** Opens YouTube search for this query */
  youtubeSearchQuery: string;
  points: number;
  completionMessage: (petName: string) => string;
}

export const MISSIONS: Record<string, MissionDefinition> = {
  mission_training: {
    code: 'mission_training',
    type: 'steps_with_levels',
    heroEmoji: '🐾',
    title: (petName) => `Practicar "Esperá" con ${petName}`,
    subtitle: 'Control de impulsos en 5 pasos. Elegí el nivel y arrancá.',
    steps: [
      { emoji: '🪑', text: 'Pedile que se siente', hint: 'Esperá que esté quieto antes de continuar' },
      { emoji: '✋', text: 'Mostrá la palma abierta frente a su cara', hint: 'Decí "Esperá" en voz calma y firme' },
      { emoji: '🚶', text: 'Dá un paso atrás lentamente', hint: 'Mantenete mirándolo' },
      { emoji: '⏱️', text: 'Esperá que mantenga la posición', hint: 'Sin hablarle ni mirarlo fijo' },
      { emoji: '🎉', text: '¡Si esperó: premialo de inmediato!', hint: 'Premio + "¡Muy bien!" con entusiasmo' },
    ],
    levels: [
      { id: 'easy', label: 'Fácil', badge: '🟢', description: 'Sin distracciones', timerSeconds: 3 },
      { id: 'medium', label: 'Medio', badge: '🟡', description: 'Juguete en el piso', timerSeconds: 5 },
      { id: 'hard', label: 'Difícil', badge: '🔴', description: 'Distracciones activas', timerSeconds: 10 },
    ],
    defaultLevelId: 'easy',
    youtubeSearchQuery: 'enseñar perro esperar comando adiestramiento',
    points: 20,
    completionMessage: (petName) => `¡${petName} está aprendiendo control de impulsos! Cada sesión suma.`,
  },

  mission_sleep: {
    code: 'mission_sleep',
    type: 'timed_steps',
    heroEmoji: '🌙',
    title: (petName) => `Rutina de calma para ${petName}`,
    subtitle: '10 min antes de dormir. Cuatro pasos para un cierre tranquilo.',
    steps: [
      { emoji: '🪮', text: 'Cepillado suave', hint: '2 min — movimientos lentos y suaves' },
      { emoji: '👂', text: 'Masaje en las orejas', hint: '1 min — sin presión, solo contacto' },
      { emoji: '🌬️', text: 'Respiración lenta juntos', hint: '2 min — respirá hondo, él/ella lo siente' },
      { emoji: '💡', text: 'Luz baja, sin estímulos', hint: 'Silencio hasta que se duerma' },
    ],
    youtubeSearchQuery: 'rutina calma relajacion perro antes dormir',
    points: 10,
    completionMessage: (petName) => `Una noche tranquila para ${petName}. Esta rutina reduce el estrés a largo plazo.`,
  },

  mission_kitchen: {
    code: 'mission_kitchen',
    type: 'checklist',
    heroEmoji: '🔍',
    title: (petName) => `Chequeo de seguridad para ${petName}`,
    subtitle: 'Revisá que no haya riesgos en cocina y basura. Un tick a la vez.',
    checklist: [
      { id: 'trash', emoji: '🗑️', text: 'Basura con tapa o fuera de alcance' },
      { id: 'chocolate', emoji: '🍫', text: 'Chocolates, uvas y pasas guardados' },
      { id: 'cleaning', emoji: '🧴', text: 'Productos de limpieza en armario cerrado' },
      { id: 'bags', emoji: '🛍️', text: 'Bolsas plásticas fuera del alcance' },
      { id: 'counter', emoji: '🍗', text: 'Sin comida suelta en mesada o mesas bajas' },
    ],
    youtubeSearchQuery: 'alimentos peligrosos toxicos perros chocolate uvas',
    points: 15,
    completionMessage: (petName) => `Cocina segura, ${petName} protegido/a. Hacé este chequeo cada semana.`,
  },
};
