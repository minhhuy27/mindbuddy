import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format, endOfMonth } from 'date-fns';

// Built-in mood defaults (fallback khi không có allMoods)
const DEFAULT_MOOD_LABELS = { 1: 'Tuyệt vời', 2: 'Vui', 3: 'Bình thường', 4: 'Buồn', 5: 'Căng thẳng' };
const DEFAULT_MOOD_COLORS = { 1: '#55efc4', 2: '#74b9ff', 3: '#fdcb6e', 4: '#fd79a8', 5: '#e17055' };
const DEFAULT_MOOD_SCORES = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

// Resolve mood info từ allMoods (built-in + custom) hoặc fallback
function getMoodInfo(moodId, allMoods) {
  if (allMoods && allMoods.length > 0) {
    const m = allMoods.find(x => x.id === moodId || x.id === Number(moodId));
    if (m) return { label: m.label, color: m.color, score: m.score, emoji: m.emoji };
  }
  return {
    label: DEFAULT_MOOD_LABELS[moodId] || 'Không rõ',
    color: DEFAULT_MOOD_COLORS[moodId] || '#ccc',
    score: DEFAULT_MOOD_SCORES[moodId] || 3,
    emoji: '',
  };
}

// ── Shared styles ──────────────────────────────────────────────────────────
const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a2e; padding: 32px; width: 794px; }
  .header { background: linear-gradient(135deg, #6c63ff, #a29bfe); color: white; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }
  .header h1 { font-size: 24px; margin-bottom: 4px; }
  .header p { opacity: 0.85; font-size: 13px; }
  h2 { font-size: 15px; font-weight: 700; color: #6c63ff; margin: 20px 0 10px; border-left: 3px solid #6c63ff; padding-left: 10px; }
  h3 { font-size: 13px; font-weight: 700; color: #444; margin: 16px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #6c63ff; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }
  td { padding: 7px 12px; border-bottom: 1px solid #e0e6ff; font-size: 12px; vertical-align: top; }
  tr:nth-child(even) td { background: #f5f3ff; }
  .month-block { margin-bottom: 28px; border: 1px solid #e0e6ff; border-radius: 10px; overflow: hidden; }
  .month-title { background: #ede9ff; padding: 10px 16px; font-size: 14px; font-weight: 700; color: #6c63ff; }
  .month-stats { display: flex; gap: 16px; padding: 10px 16px; background: #faf9ff; border-bottom: 1px solid #e0e6ff; flex-wrap: wrap; }
  .stat-chip { font-size: 11px; color: #555; }
  .stat-chip strong { color: #6c63ff; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
  .footer { margin-top: 32px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #e0e6ff; padding-top: 12px; }
  .badge-custom { display: inline-block; font-size: 10px; background: #ede9ff; color: #6c63ff; border-radius: 6px; padding: 1px 5px; margin-left: 4px; }
  .summary-box { background: #f0fff4; border-left: 3px solid #55efc4; border-radius: 6px; padding: 10px 14px; margin: 8px 0 16px; font-size: 12px; color: #2d6a4f; }
`;

// ── Build stats cho một tập logs ──────────────────────────────────────────
function buildStats(logs, allMoods) {
  const totalEntries = logs.length;
  if (totalEntries === 0) return { totalEntries: 0, avgScore: 'N/A', mostFreq: null, moodCount: {} };

  const moodCount = {};
  logs.forEach(l => { moodCount[l.mood] = (moodCount[l.mood] || 0) + 1; });

  const avgScore = (
    logs.reduce((s, l) => s + (getMoodInfo(l.mood, allMoods).score || 3), 0) / totalEntries
  ).toFixed(1);

  const mostFreqEntry = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
  const mostFreq = mostFreqEntry
    ? { ...getMoodInfo(mostFreqEntry[0], allMoods), count: mostFreqEntry[1] }
    : null;

  return { totalEntries, avgScore, mostFreq, moodCount };
}

// ── Render rows nhật ký ───────────────────────────────────────────────────
function renderLogRows(logs, allMoods) {
  return logs.map(l => {
    const mood = getMoodInfo(l.mood, allMoods);
    const isCustom = String(l.mood).startsWith('custom_');
    const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
    const causeTags = l.note?.match(/\[(.+)\]/)?.[1] || '';
    return `<tr>
      <td style="white-space:nowrap">${format(new Date(l.date), 'dd/MM/yyyy HH:mm')}</td>
      <td>
        <span style="color:${mood.color};font-weight:600">${mood.emoji ? mood.emoji + ' ' : ''}${mood.label}</span>
        ${isCustom ? '<span class="badge-custom">tùy chỉnh</span>' : ''}
      </td>
      <td style="color:#666;font-size:11px">${causeTags}</td>
      <td>${cleanNote}</td>
    </tr>`;
  }).join('');
}

// ── HTML cho xuất theo tháng ──────────────────────────────────────────────
function buildMonthHTML({ userName, moodLogs, month, year, allMoods }) {
  const monthStr = `Tháng ${month + 1}/${year}`;
  const end = endOfMonth(new Date(year, month, 1));

  const logs = [...moodLogs]
    .filter(l => {
      const d = new Date(l.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const { totalEntries, avgScore, mostFreq, moodCount } = buildStats(logs, allMoods);
  const uniqueDays = new Set(logs.map(l => new Date(l.date).toDateString())).size;

  const statsRows = [
    ['Số ngày có ghi chú', `${uniqueDays} / ${end.getDate()} ngày`],
    ['Tổng số ghi chú', `${totalEntries} lần`],
    ['Điểm cảm xúc trung bình', `${avgScore} / 5`],
    ['Cảm xúc phổ biến nhất', mostFreq ? `${mostFreq.emoji || ''} ${mostFreq.label} (${mostFreq.count} lần)` : 'N/A'],
    ['Tỉ lệ ngày check-in', `${Math.round(uniqueDays / end.getDate() * 100)}%`],
  ];

  // Phân bố cảm xúc — chỉ hiện mood đã dùng
  const usedMoods = Object.keys(moodCount).map(id => ({
    ...getMoodInfo(id, allMoods),
    id,
    count: moodCount[id],
    pct: totalEntries > 0 ? Math.round(moodCount[id] / totalEntries * 100) : 0,
  })).sort((a, b) => b.count - a.count);

  const distRows = usedMoods.map(m =>
    `<tr>
      <td><span class="dot" style="background:${m.color}"></span>${m.emoji || ''} ${m.label}</td>
      <td style="text-align:center">${m.count}</td>
      <td style="text-align:center">${m.pct}%</td>
    </tr>`
  ).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  <div class="header">
    <h1>🧠 MindBuddy – Báo cáo cảm xúc</h1>
    <p>${monthStr} &nbsp;|&nbsp; ${userName} &nbsp;|&nbsp; Xuất ngày: ${format(new Date(), 'dd/MM/yyyy')}</p>
  </div>

  <h2>Tổng quan ${monthStr}</h2>
  <table>
    <thead><tr><th>Chỉ số</th><th>Kết quả</th></tr></thead>
    <tbody>${statsRows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}</tbody>
  </table>

  ${usedMoods.length > 0 ? `
  <h2>Phân bố cảm xúc</h2>
  <table>
    <thead><tr><th>Cảm xúc</th><th style="text-align:center">Số lần</th><th style="text-align:center">Tỉ lệ</th></tr></thead>
    <tbody>${distRows}</tbody>
  </table>` : ''}

  ${logs.length > 0 ? `
  <h2>Nhật ký chi tiết</h2>
  <table>
    <thead><tr><th>Ngày giờ</th><th>Cảm xúc</th><th>Nguyên nhân</th><th>Ghi chú</th></tr></thead>
    <tbody>${renderLogRows(logs, allMoods)}</tbody>
  </table>` : '<p style="color:#999;margin-top:16px">Không có dữ liệu trong tháng này.</p>'}

  <div class="footer">MindBuddy – Trợ lý sức khỏe tâm thần cho sinh viên &nbsp;|&nbsp; "Cùng bạn vượt qua áp lực, kiến tạo tương lai."</div>
</body></html>`;
}

// ── HTML cho xuất toàn bộ ─────────────────────────────────────────────────
function buildAllHTML({ userName, moodLogs, allMoods }) {
  if (moodLogs.length === 0) return null;

  const sorted = [...moodLogs].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Nhóm theo tháng
  const monthMap = {};
  sorted.forEach(l => {
    const d = new Date(l.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(l);
  });

  const months = Object.keys(monthMap).sort((a, b) => b.localeCompare(a)); // mới nhất trước

  // Thống kê tổng
  const { totalEntries, avgScore, mostFreq } = buildStats(sorted, allMoods);
  const uniqueDays = new Set(sorted.map(l => new Date(l.date).toDateString())).size;
  const firstDate = new Date(sorted[sorted.length - 1].date);
  const lastDate = new Date(sorted[0].date);

  const overallStats = [
    ['Thời gian ghi chép', `${format(firstDate, 'dd/MM/yyyy')} – ${format(lastDate, 'dd/MM/yyyy')}`],
    ['Tổng số ghi chú', `${totalEntries} lần`],
    ['Số ngày có ghi chú', `${uniqueDays} ngày`],
    ['Điểm cảm xúc trung bình', `${avgScore} / 5`],
    ['Cảm xúc phổ biến nhất', mostFreq ? `${mostFreq.emoji || ''} ${mostFreq.label} (${mostFreq.count} lần)` : 'N/A'],
    ['Số tháng ghi chép', `${months.length} tháng`],
  ];

  // Render từng tháng
  const monthBlocks = months.map(key => {
    const [y, m] = key.split('-').map(Number);
    const logs = monthMap[key];
    const { totalEntries: te, avgScore: avg, mostFreq: mf } = buildStats(logs, allMoods);
    const uniqueDaysMonth = new Set(logs.map(l => new Date(l.date).toDateString())).size;

    return `
    <div class="month-block">
      <div class="month-title">📅 Tháng ${m}/${y} &nbsp;—&nbsp; ${te} ghi chú, ${uniqueDaysMonth} ngày</div>
      <div class="month-stats">
        <span class="stat-chip">Trung bình: <strong>${avg}/5</strong></span>
        ${mf ? `<span class="stat-chip">Phổ biến: <strong>${mf.emoji || ''} ${mf.label}</strong></span>` : ''}
      </div>
      <table>
        <thead><tr><th>Ngày giờ</th><th>Cảm xúc</th><th>Nguyên nhân</th><th>Ghi chú</th></tr></thead>
        <tbody>${renderLogRows(logs, allMoods)}</tbody>
      </table>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${BASE_STYLES}</style></head>
<body>
  <div class="header">
    <h1>🧠 MindBuddy – Toàn bộ nhật ký cảm xúc</h1>
    <p>${userName} &nbsp;|&nbsp; Xuất ngày: ${format(new Date(), 'dd/MM/yyyy')} &nbsp;|&nbsp; ${months.length} tháng · ${totalEntries} ghi chú</p>
  </div>

  <h2>Tổng quan toàn bộ</h2>
  <table>
    <thead><tr><th>Chỉ số</th><th>Kết quả</th></tr></thead>
    <tbody>${overallStats.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}</tbody>
  </table>

  <h2>Chi tiết theo tháng</h2>
  ${monthBlocks}

  <div class="footer">MindBuddy – Trợ lý sức khỏe tâm thần cho sinh viên &nbsp;|&nbsp; "Cùng bạn vượt qua áp lực, kiến tạo tương lai."</div>
</body></html>`;
}

// ── Hàm render HTML → PDF ─────────────────────────────────────────────────
async function renderToPDF(html, filename) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 794 + 64, // width + padding
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -y, pageW, imgH);
      y += pageH;
    }
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

// ── Export theo tháng ─────────────────────────────────────────────────────
export async function exportMoodPDF({ userName, moodLogs, month, year, allMoods }) {
  const html = buildMonthHTML({ userName, moodLogs, month, year, allMoods });
  await renderToPDF(html, `MindBuddy_T${month + 1}-${year}.pdf`);
}

// ── Export toàn bộ ────────────────────────────────────────────────────────
export async function exportAllMoodPDF({ userName, moodLogs, allMoods }) {
  const html = buildAllHTML({ userName, moodLogs, allMoods });
  if (!html) return;
  await renderToPDF(html, `MindBuddy_ToanBo_${format(new Date(), 'ddMMyyyy')}.pdf`);
}
