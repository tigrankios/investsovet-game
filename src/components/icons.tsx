const s = { display: 'inline-block', verticalAlign: 'middle' } as const;

// --- Game Icons ---

export function IconLong({ size = 20, color = '#00E676' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 4L20 14H4L12 4Z" fill={color} />
      <rect x="10" y="13" width="4" height="7" rx="1" fill={color} opacity={0.6} />
    </svg>
  );
}

export function IconShort({ size = 20, color = '#FF1744' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 20L4 10H20L12 20Z" fill={color} />
      <rect x="10" y="4" width="4" height="7" rx="1" fill={color} opacity={0.6} />
    </svg>
  );
}

export function IconChart({ size = 24, color = '#00E676' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M3 20L7 14L11 16L15 8L21 4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 4H21V10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTrophy({ size = 24, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M8 21H16M12 17V21M6 3H18L17 9C17 12 14.76 14 12 14C9.24 14 7 12 7 9L6 3Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 5H3V8C3 9.66 4.34 11 6 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 5H21V8C21 9.66 19.66 11 18 11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSilver({ size = 24 }: { size?: number }) {
  return <IconTrophy size={size} color="#94A3B8" />;
}

export function IconBronze({ size = 24 }: { size?: number }) {
  return <IconTrophy size={size} color="#D97706" />;
}

export function IconCrown({ size = 20, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M2 18L4 8L8 12L12 4L16 12L20 8L22 18H2Z" fill={color} />
      <rect x="2" y="18" width="20" height="3" rx="1" fill={color} opacity={0.7} />
    </svg>
  );
}

export function IconFinish({ size = 40, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={s}>
      {/* Checkered flag */}
      <rect x="8" y="4" width="4" height="4" fill={color} />
      <rect x="16" y="4" width="4" height="4" fill={color} />
      <rect x="12" y="8" width="4" height="4" fill={color} />
      <rect x="20" y="8" width="4" height="4" fill={color} />
      <rect x="8" y="12" width="4" height="4" fill={color} />
      <rect x="16" y="12" width="4" height="4" fill={color} />
      <rect x="12" y="16" width="4" height="4" fill={color} opacity={0.6} />
      <rect x="8" y="16" width="4" height="4" fill={color} opacity={0.3} />
      <rect x="6" y="4" width="2" height="24" rx="1" fill={color} opacity={0.8} />
    </svg>
  );
}

export function IconTV({ size = 24, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <rect x="2" y="4" width="20" height="14" rx="2" stroke={color} strokeWidth="2" />
      <path d="M8 22H16M12 18V22" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M7 9L10 12L7 15" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPhone({ size = 24, color = '#00E676' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <rect x="6" y="2" width="12" height="20" rx="3" stroke={color} strokeWidth="2" />
      <circle cx="12" cy="18" r="1" fill={color} />
      <line x1="9" y1="5" x2="15" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconDice({ size = 24, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="2" />
      <circle cx="8" cy="8" r="1.5" fill={color} />
      <circle cx="16" cy="8" r="1.5" fill={color} />
      <circle cx="12" cy="12" r="1.5" fill={color} />
      <circle cx="8" cy="16" r="1.5" fill={color} />
      <circle cx="16" cy="16" r="1.5" fill={color} />
    </svg>
  );
}

// --- Bonus Mini-game Icons ---

export function IconWheel({ size = 32, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={s}>
      <circle cx="16" cy="16" r="13" stroke={color} strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill={color} />
      <line x1="16" y1="3" x2="16" y2="10" stroke={color} strokeWidth="1.5" />
      <line x1="16" y1="22" x2="16" y2="29" stroke={color} strokeWidth="1.5" />
      <line x1="3" y1="16" x2="10" y2="16" stroke={color} strokeWidth="1.5" />
      <line x1="22" y1="16" x2="29" y2="16" stroke={color} strokeWidth="1.5" />
      <line x1="6.8" y1="6.8" x2="11.1" y2="11.1" stroke={color} strokeWidth="1" />
      <line x1="20.9" y1="20.9" x2="25.2" y2="25.2" stroke={color} strokeWidth="1" />
      <line x1="25.2" y1="6.8" x2="20.9" y2="11.1" stroke={color} strokeWidth="1" />
      <line x1="11.1" y1="20.9" x2="6.8" y2="25.2" stroke={color} strokeWidth="1" />
    </svg>
  );
}

export function IconSlots({ size = 32, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={s}>
      <rect x="3" y="6" width="26" height="20" rx="3" stroke={color} strokeWidth="2" />
      <line x1="12" y1="6" x2="12" y2="26" stroke={color} strokeWidth="1.5" />
      <line x1="20" y1="6" x2="20" y2="26" stroke={color} strokeWidth="1.5" />
      <text x="7.5" y="19" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">$</text>
      <text x="15" y="19" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">$</text>
      <text x="23" y="19" fill={color} fontSize="10" fontWeight="bold" fontFamily="monospace">$</text>
      <path d="M27 12H30V20H27" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconLootbox({ size = 32, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={s}>
      <rect x="4" y="12" width="24" height="16" rx="2" stroke={color} strokeWidth="2" />
      <rect x="4" y="8" width="24" height="6" rx="2" stroke={color} strokeWidth="2" />
      <line x1="16" y1="8" x2="16" y2="28" stroke={color} strokeWidth="2" />
      <path d="M16 8C16 8 14 4 10 4C7 4 6 6 6 7C6 8 7 8 8 8" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M16 8C16 8 18 4 22 4C25 4 26 6 26 7C26 8 25 8 24 8" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function IconLoto({ size = 32, color = '#FFD740' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={s}>
      <circle cx="16" cy="16" r="12" stroke={color} strokeWidth="2" />
      <text x="16" y="20" fill={color} fontSize="12" fontWeight="bold" textAnchor="middle" fontFamily="monospace">7</text>
      <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1" opacity={0.4} />
      <circle cx="24" cy="24" r="3" stroke={color} strokeWidth="1" opacity={0.4} />
    </svg>
  );
}

// --- Skill Icons ---

export function IconSkillTrump({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 2L15 8H21L16 12L18 19L12 15L6 19L8 12L3 8H9L12 2Z" fill="#FFD740" />
    </svg>
  );
}

export function IconSkillInverse({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M4 7H14L10 3" stroke="#448AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H10L14 21" stroke="#448AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSkillShield({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 3L4 7V12C4 16.42 7.4 20.5 12 21.5C16.6 20.5 20 16.42 20 12V7L12 3Z" stroke="#00E676" strokeWidth="2" fill="#00E676" fillOpacity={0.15} />
      <path d="M9 12L11 14L15 10" stroke="#00E676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSkillDouble({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <circle cx="9" cy="12" r="6" stroke="#FFD740" strokeWidth="2" />
      <circle cx="15" cy="12" r="6" stroke="#FFD740" strokeWidth="2" />
      <text x="12" y="15" fill="#FFD740" fontSize="8" fontWeight="bold" textAnchor="middle">x2</text>
    </svg>
  );
}

export function IconSkillFreeze({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <line x1="12" y1="2" x2="12" y2="22" stroke="#448AFF" strokeWidth="2" />
      <line x1="2" y1="12" x2="22" y2="12" stroke="#448AFF" strokeWidth="2" />
      <line x1="5" y1="5" x2="19" y2="19" stroke="#448AFF" strokeWidth="1.5" />
      <line x1="19" y1="5" x2="5" y2="19" stroke="#448AFF" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="#448AFF" fillOpacity={0.3} />
    </svg>
  );
}

export function IconSkillBlind({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M4 4L20 20" stroke="#B388FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M1 12C3 7 7 4 12 4C14 4 15.5 4.5 17 5.5" stroke="#B388FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 12C21 17 17 20 12 20C10 20 8.5 19.5 7 18.5" stroke="#B388FF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconSkillSteal({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 2C9.5 2 8 4 8 6C8 8 9.5 9 12 9C14.5 9 16 8 16 6C16 4 14.5 2 12 2Z" stroke="#FF1744" strokeWidth="2" />
      <path d="M6 22V18C6 15 8.7 13 12 13C15.3 13 18 15 18 18V22" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 17L18 13" stroke="#FF1744" strokeWidth="2" strokeLinecap="round" />
      <path d="M18 13L20 15" stroke="#FF1744" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconSkillChaos({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={s}>
      <path d="M12 3C8 8 4 10 4 14C4 18 8 22 12 22C16 22 20 18 20 14C20 10 16 8 12 3Z" stroke="#FF1744" strokeWidth="2" fill="#FF1744" fillOpacity={0.1} />
      <path d="M10 13C10 13 12 11 14 13C14 13 12 15 10 13Z" fill="#FF1744" />
    </svg>
  );
}

export const SKILL_ICON_MAP: Record<string, (props: { size?: number }) => React.ReactNode> = {
  trump_tweet: IconSkillTrump,
  inverse: IconSkillInverse,
  shield: IconSkillShield,
  double_or_nothing: IconSkillDouble,
  freeze: IconSkillFreeze,
  blind: IconSkillBlind,
  steal: IconSkillSteal,
  chaos: IconSkillChaos,
};

// Bonus type icon map
export const BONUS_ICON_MAP: Record<string, (props: { size?: number; color?: string }) => React.ReactNode> = {
  wheel: IconWheel,
  slots: IconSlots,
  lootbox: IconLootbox,
  loto: IconLoto,
};
