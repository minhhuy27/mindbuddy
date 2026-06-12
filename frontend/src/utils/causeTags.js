const CAUSE_GROUPS = [
  {
    label: 'Học tập',
    color: '#6366f1',
    bg: '#eef2ff',
    border: '#c7d2fe',
    aliases: ['hoc tap', 'hoc', 'thi cu', 'thi', 'bai tap', 'deadline', 'truong', 'dai hoc', 'bao cao'],
  },
  {
    label: 'Gia đình',
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fed7aa',
    aliases: ['gia dinh', 'ba me', 'bo me', 'me', 'ba', 'cha', 'anh chi em', 'ba noi', 'ong ba'],
  },
  {
    label: 'Sức khỏe',
    color: '#10b981',
    bg: '#ecfdf5',
    border: '#a7f3d0',
    aliases: ['suc khoe', 'benh', 'om', 'met', 'ngu', 'thieu ngu', 'dau', 'ho', 'cam'],
  },
  {
    label: 'Thời tiết',
    color: '#0ea5e9',
    bg: '#e0f2fe',
    border: '#bae6fd',
    aliases: ['thoi tiet', 'troi', 'nang', 'nong', 'mua', 'lanh', 'am', 'bao', 'sam chop'],
  },
  {
    label: 'Tài chính',
    color: '#ca8a04',
    bg: '#fefce8',
    border: '#fde68a',
    aliases: ['tai chinh', 'tien', 'chi phi', 'mua sam', 've tau', 'tiet kiem', 'no'],
  },
  {
    label: 'Quan hệ',
    color: '#ec4899',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    aliases: ['quan he', 'ban be', 'ban than', 'tinh yeu', 'nguoi yeu', 'ban gai', 'ban trai', 'dong nghiep'],
  },
  {
    label: 'Riêng tư',
    color: '#64748b',
    bg: '#f1f5f9',
    border: '#cbd5e1',
    aliases: ['rieng tu', 'ca nhan', 'khac', 'noi tam', 'mot minh'],
  },
];

const FALLBACK_COLORS = [
  { color: '#7c3aed', bg: '#f3e8ff', border: '#ddd6fe' },
  { color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
];

function normalizeCauseText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function hashText(value) {
  return normalizeCauseText(value).split('').reduce((hash, char) => (
    ((hash << 5) - hash) + char.charCodeAt(0)
  ), 0);
}

function findCauseGroup(cause) {
  const normalized = normalizeCauseText(cause);
  if (!normalized) return CAUSE_GROUPS[6];

  return CAUSE_GROUPS.find(group => {
    if (normalizeCauseText(group.label) === normalized) return true;
    return group.aliases.some(alias => normalized === alias || (alias.length >= 3 && normalized.includes(alias)));
  });
}

export function getCauseTagMeta(cause) {
  const label = String(cause || '').trim() || 'Khác';
  const group = findCauseGroup(label);
  if (group) {
    return {
      label,
      group: group.label,
      color: group.color,
      bg: group.bg,
      border: group.border,
    };
  }

  const fallback = FALLBACK_COLORS[Math.abs(hashText(label)) % FALLBACK_COLORS.length];
  return {
    label,
    group: 'Tùy chỉnh',
    ...fallback,
  };
}

export function causeTagStyle(cause) {
  const meta = getCauseTagMeta(cause);
  return {
    '--cause-color': meta.color,
    '--cause-bg': meta.bg,
    '--cause-border': meta.border,
  };
}

export function causeTagTitle(cause) {
  const meta = getCauseTagMeta(cause);
  return meta.group && meta.group !== meta.label
    ? `${meta.label} · nhóm ${meta.group}`
    : meta.label;
}
