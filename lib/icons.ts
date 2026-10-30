import {
  AudioLines, Bell, Bomb, Clapperboard, Drum, Flame, Gamepad2, Ghost, Hand, Heart, Laugh, Megaphone,
  Music, PartyPopper, Siren, Skull, Smile, Star, Swords, Trophy, Zap,
} from 'lucide-vue-next'

/** Minimal, monochrome pad icons. */
export const PAD_ICONS = {
  music: Music, laugh: Laugh, bell: Bell, zap: Zap, drum: Drum, megaphone: Megaphone, siren: Siren,
  party: PartyPopper, ghost: Ghost, heart: Heart, star: Star, flame: Flame, trophy: Trophy, skull: Skull,
  smile: Smile, clap: Clapperboard, game: Gamepad2, swords: Swords, bomb: Bomb, hand: Hand, wave: AudioLines,
} as const

export type PadIconName = keyof typeof PAD_ICONS
