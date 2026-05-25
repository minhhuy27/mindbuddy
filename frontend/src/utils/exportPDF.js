import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { endOfMonth, format } from 'date-fns';
import { getBlob, ref as storageRef } from 'firebase/storage';
import { storage } from '../firebase';
import { normalizeMoodAttachments } from './moodImages';

const DEFAULT_MOOD_LABELS = { 1: 'Tuyệt vời', 2: 'Vui', 3: 'Bình thường', 4: 'Buồn', 5: 'Căng thẳng' };
const DEFAULT_MOOD_COLORS = { 1: '#55efc4', 2: '#74b9ff', 3: '#fdcb6e', 4: '#fd79a8', 5: '#e17055' };
const DEFAULT_MOOD_SCORES = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_BODY_CAPACITY = 900;
const THUMBNAIL_WIDTH = 720;
const THUMBNAIL_HEIGHT = 540;
const IMAGE_LOAD_TIMEOUT_MS = 8000;
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const thumbnailCache = new Map();

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMoodInfo(moodId, allMoods) {
  if (allMoods?.length) {
    const mood = allMoods.find(item => item.id === moodId || item.id === Number(moodId));
    if (mood) return { label: mood.label, color: mood.color, score: mood.score, emoji: mood.emoji };
  }
  return {
    label: DEFAULT_MOOD_LABELS[moodId] || 'Không rõ',
    color: DEFAULT_MOOD_COLORS[moodId] || '#a29bfe',
    score: DEFAULT_MOOD_SCORES[moodId] || 3,
    emoji: '',
  };
}

function cleanNote(note = '') {
  return note.replace(/\s*\[.+\]$/, '').trim();
}

function renderInlineRichText(text = '') {
  let safe = escapeHtml(text);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/gi, '<u>$1</u>');
  return safe;
}

function renderRichNote(note = '') {
  const source = cleanNote(note || '');
  if (!source) return '<div class="note-line muted">Không có ghi chú thêm.</div>';

  return source.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<div class="note-space"></div>';

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      return `<div class="note-heading level-${heading[1].length}">${renderInlineRichText(heading[2])}</div>`;
    }

    const checklist = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (checklist) {
      const checked = checklist[1].toLowerCase() === 'x';
      return `<div class="note-check ${checked ? 'checked' : ''}"><i>${checked ? '✓' : ''}</i><span>${renderInlineRichText(checklist[2])}</span></div>`;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      return `<div class="note-quote">${renderInlineRichText(quote[1])}</div>`;
    }

    return `<div class="note-line">${renderInlineRichText(line)}</div>`;
  }).join('');
}

function extractCauses(note = '') {
  return note.match(/\[(.+)\]$/)?.[1]?.split(', ').filter(Boolean) || [];
}

function normalizeMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : null;
}

function metricLine(metrics = {}) {
  const items = [
    ['Stress', normalizeMetric(metrics.stress)],
    ['Năng lượng', normalizeMetric(metrics.energy)],
    ['Giấc ngủ', normalizeMetric(metrics.sleep)],
    ['Tập trung', normalizeMetric(metrics.focus)],
  ].filter(([, value]) => value !== null);

  return items.length
    ? items.map(([label, value]) => `${label}: ${value}/5`).join(' · ')
    : '';
}

function attachmentLine(log) {
  const counts = normalizeMoodAttachments(log).reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {});
  const parts = [
    counts.image ? `${counts.image} ảnh` : '',
    counts.video ? `${counts.video} video` : '',
    counts.audio ? `${counts.audio} âm thanh` : '',
    counts.file ? `${counts.file} tệp` : '',
  ].filter(Boolean);
  return parts.join(' · ');
}

function buildStats(logs, allMoods, periodDays = null) {
  const totalEntries = logs.length;
  if (!totalEntries) {
    return {
      totalEntries: 0,
      uniqueDays: 0,
      avgScore: 'N/A',
      mostFreq: null,
      moodCount: {},
      mediaCount: 0,
      checkinRate: periodDays ? '0%' : '',
    };
  }

  const moodCount = {};
  logs.forEach(log => {
    moodCount[log.mood] = (moodCount[log.mood] || 0) + 1;
  });

  const uniqueDays = new Set(logs.map(log => new Date(log.date).toDateString())).size;
  const avgScore = (
    logs.reduce((sum, log) => sum + (getMoodInfo(log.mood, allMoods).score || 3), 0) / totalEntries
  ).toFixed(1);
  const mostFreqEntry = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0];
  const mostFreq = mostFreqEntry
    ? { ...getMoodInfo(mostFreqEntry[0], allMoods), count: mostFreqEntry[1] }
    : null;
  const mediaCount = logs.reduce((sum, log) => sum + normalizeMoodAttachments(log).length, 0);

  return {
    totalEntries,
    uniqueDays,
    avgScore,
    mostFreq,
    moodCount,
    mediaCount,
    checkinRate: periodDays ? `${Math.round((uniqueDays / periodDays) * 100)}%` : '',
  };
}

function moodDistribution(stats, allMoods) {
  return Object.keys(stats.moodCount)
    .map(id => ({
      ...getMoodInfo(id, allMoods),
      id,
      count: stats.moodCount[id],
      pct: stats.totalEntries ? Math.round((stats.moodCount[id] / stats.totalEntries) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function estimateLogHeight(log) {
  const noteLength = cleanNote(log.note || '').length;
  const causes = extractCauses(log.note || '').length;
  const metrics = metricLine(log.metrics || '') ? 1 : 0;
  const media = attachmentLine(log) ? 1 : 0;
  const blocks = cleanNote(log.note || '').split(/\r?\n/).length;
  return Math.min(240, 40 + Math.ceil(noteLength / 110) * 13 + blocks * 5 + causes * 3 + (metrics + media) * 10);
}

function paginateLogs(logs) {
  const pages = [];
  let current = [];
  let used = 0;

  logs.forEach(log => {
    const height = Math.min(260, estimateLogHeight(log));
    if (current.length && used + height > PAGE_BODY_CAPACITY) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(log);
    used += height;
  });

  if (current.length) pages.push(current);
  return pages;
}

function collectImageAttachments(logs, allMoods) {
  const images = logs.flatMap(log => {
    const mood = getMoodInfo(log.mood, allMoods);
    return normalizeMoodAttachments(log)
      .filter(item => item.kind === 'image' && item.url)
      .map((item, index) => ({
        ...item,
        id: `${log.id || log.date}-${index}`,
        date: log.date,
        mood,
      }));
  });
  return images.map((image, renderIndex) => ({ ...image, renderIndex }));
}

function paginateImages(images, perPage = 9) {
  const pages = [];
  for (let index = 0; index < images.length; index += perPage) {
    pages.push(images.slice(index, index + perPage));
  }
  return pages;
}

function withTimeout(promise, ms, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function fetchImageBlob(image) {
  if (image.url) {
    try {
      const proxied = await fetch(`${API_BASE}/media/image?url=${encodeURIComponent(image.url)}`, {
        cache: 'force-cache',
      });
      if (proxied.ok) return proxied.blob();
    } catch (error) {
      console.warn('Image proxy unavailable, trying Firebase Storage fallback:', error?.message || error);
    }
  }
  if (image.path) {
    try {
      return await getBlob(storageRef(storage, image.path));
    } catch (error) {
      console.warn('Firebase Storage blob fallback failed, trying direct URL:', error?.message || error);
    }
  }
  const response = await fetch(image.url, { mode: 'cors', cache: 'force-cache' });
  if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`);
  return response.blob();
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh'));
    };
    img.src = url;
  });
}

function drawCoverImage(img, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const scale = Math.max(width / img.width, height / img.height);
  const sw = width / scale;
  const sh = height / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

function makeImageFallbackDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">
      <rect width="100%" height="100%" fill="#eef2ff"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#7a849d" font-family="Arial, sans-serif" font-size="28" font-weight="700">Không tải được ảnh</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function imageToThumbnailDataUrl(image) {
  const cacheKey = image.path || image.url;
  if (thumbnailCache.has(cacheKey)) return thumbnailCache.get(cacheKey);

  try {
    const blob = await withTimeout(
      fetchImageBlob(image),
      IMAGE_LOAD_TIMEOUT_MS,
      'Tải ảnh quá lâu'
    );
    const img = await withTimeout(
      loadImageFromBlob(blob),
      IMAGE_LOAD_TIMEOUT_MS,
      'Đọc ảnh quá lâu'
    );
    const dataUrl = drawCoverImage(img, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    thumbnailCache.set(cacheKey, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn('Không thể nhúng ảnh vào PDF:', {
      path: image.path,
      url: image.url,
      error: error?.message || error,
    });
    const fallback = makeImageFallbackDataUrl();
    thumbnailCache.set(cacheKey, fallback);
    return fallback;
  }
}

async function prepareImageAttachments(images) {
  return Promise.all(images.map(async image => ({
    ...image,
    renderUrl: await imageToThumbnailDataUrl(image),
  })));
}

function renderStatCards(items) {
  return `
    <div class="stat-grid">
      ${items.map(item => `
        <div class="stat-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function renderDistribution(distribution) {
  if (!distribution.length) return '<p class="muted">Chưa có dữ liệu cảm xúc trong khoảng này.</p>';
  return `
    <div class="distribution">
      ${distribution.map(item => `
        <div class="distribution-row">
          <div><i style="background:${item.color}"></i><span>${escapeHtml(`${item.emoji || ''} ${item.label}`.trim())}</span></div>
          <strong>${item.count} lần</strong>
          <em>${item.pct}%</em>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLogTable(logs, allMoods) {
  return `
    <table class="detail-table">
      <thead>
        <tr>
          <th class="col-time">Thời gian</th>
          <th class="col-mood">Cảm xúc</th>
          <th class="col-meta">Chỉ số / nguyên nhân</th>
          <th class="col-note">Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(log => renderLogRow(log, allMoods)).join('')}
      </tbody>
    </table>
  `;
}

function renderLogRow(log, allMoods) {
  const mood = getMoodInfo(log.mood, allMoods);
  const causes = extractCauses(log.note || '');
  const metrics = metricLine(log.metrics || {});
  const attachments = attachmentLine(log);
  return `
    <tr style="--mood-color:${mood.color}">
      <td class="col-time">
        <strong>${format(new Date(log.date), 'dd/MM/yyyy')}</strong>
        <span>${format(new Date(log.date), 'HH:mm')}</span>
      </td>
      <td class="col-mood">
        <b>${escapeHtml(`${mood.emoji || ''} ${mood.label}`.trim())}</b>
        <span>${mood.score || 3}/5</span>
      </td>
      <td class="col-meta">
        ${metrics ? `<p>${escapeHtml(metrics)}</p>` : '<p class="muted">Chưa có chỉ số phụ</p>'}
        ${causes.length ? `<div class="tags">${causes.map(cause => `<i>${escapeHtml(cause)}</i>`).join('')}</div>` : ''}
        ${attachments ? `<p>${escapeHtml(attachments)}</p>` : ''}
      </td>
      <td class="col-note">
        <div class="note-rich">${renderRichNote(log.note || '')}</div>
      </td>
    </tr>
  `;
}

function renderImageGallery(images) {
  return `
    <section class="gallery-wrap">
      <div class="gallery-grid">
        ${images.map(image => `
          <figure class="gallery-item">
            <img src="${escapeHtml(image.renderUrl || makeImageFallbackDataUrl())}" alt="${escapeHtml(image.name || 'Ảnh check-in')}" />
            <figcaption>
              <strong>${format(new Date(image.date), 'dd/MM/yyyy HH:mm')}</strong>
              <span>${escapeHtml(`${image.mood?.emoji || ''} ${image.mood?.label || 'Không rõ'}`.trim())}</span>
            </figcaption>
          </figure>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPage({ title, subtitle, userName, body, pageNumber, totalPages, compactHeader = false }) {
  return `
    <section class="pdf-page">
      <header class="${compactHeader ? 'page-header compact' : 'page-header'}">
        <div>
          <span>MindBuddy</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div class="export-meta">
          <strong>${escapeHtml(userName)}</strong>
          <span>Xuất ngày ${format(new Date(), 'dd/MM/yyyy')}</span>
        </div>
      </header>
      <main>${body}</main>
      <footer>
        <span>Cùng bạn vượt qua áp lực, kiến tạo tương lai.</span>
        <strong>${pageNumber}/${totalPages}</strong>
      </footer>
    </section>
  `;
}

function renderCoverBody({ stats, distribution, statItems, intro }) {
  return `
    <section class="summary-card">
      <h2>Tổng quan</h2>
      <p>${escapeHtml(intro)}</p>
      ${renderStatCards(statItems)}
    </section>
    <section class="summary-card">
      <h2>Phân bố cảm xúc</h2>
      ${renderDistribution(distribution)}
    </section>
    <section class="summary-note">
      <strong>Điểm trung bình ${escapeHtml(stats.avgScore)} / 5</strong>
      <span>${stats.mostFreq ? `Cảm xúc xuất hiện nhiều nhất: ${escapeHtml(`${stats.mostFreq.emoji || ''} ${stats.mostFreq.label}`.trim())} (${stats.mostFreq.count} lần).` : 'Chưa có cảm xúc nổi bật.'}</span>
    </section>
  `;
}

async function buildDocument({ title, subtitle, userName, logs, allMoods, statItems, intro, periodDays }) {
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const stats = buildStats(sortedLogs, allMoods, periodDays);
  const distribution = moodDistribution(stats, allMoods);
  const logPages = paginateLogs(sortedLogs);
  const imageAttachments = await prepareImageAttachments(collectImageAttachments(sortedLogs, allMoods));
  const imagePages = paginateImages(imageAttachments);
  const totalPages = sortedLogs.length ? 1 + logPages.length + imagePages.length : 2;

  const pages = [
    renderPage({
      title,
      subtitle,
      userName,
      pageNumber: 1,
      totalPages,
      body: renderCoverBody({ stats, distribution, statItems, intro }),
    }),
  ];

  if (!sortedLogs.length) {
    pages.push(renderPage({
      title: 'Nhật ký chi tiết',
      subtitle,
      userName,
      pageNumber: 2,
      totalPages: 2,
      compactHeader: true,
      body: '<section class="empty-state">Không có dữ liệu trong khoảng thời gian này.</section>',
    }));
    return { html: pages.join(''), images: [] };
  }

  logPages.forEach((pageLogs, index) => {
    pages.push(renderPage({
      title: 'Nhật ký chi tiết',
      subtitle: `${subtitle} · ${sortedLogs.length} ghi chú`,
      userName,
      pageNumber: index + 2,
      totalPages,
      compactHeader: true,
      body: `<section class="table-wrap">${renderLogTable(pageLogs, allMoods)}</section>`,
    }));
  });

  imagePages.forEach((pageImages, index) => {
    pages.push(renderPage({
      title: 'Phụ lục ảnh',
      subtitle: `${subtitle} · ${imageAttachments.length} ảnh check-in`,
      userName,
      pageNumber: 1 + logPages.length + index + 1,
      totalPages,
      compactHeader: true,
      body: renderImageGallery(pageImages),
    }));
  });

  return { html: pages.join(''), images: imageAttachments };
}

async function buildMonthDocument({ userName, moodLogs, month, year, allMoods }) {
  const end = endOfMonth(new Date(year, month, 1));
  const logs = moodLogs.filter(log => {
    const date = new Date(log.date);
    return date.getMonth() === month && date.getFullYear() === year;
  });
  const stats = buildStats(logs, allMoods, end.getDate());
  const monthLabel = `Tháng ${month + 1}/${year}`;
  return await buildDocument({
    title: `Báo cáo cảm xúc ${monthLabel}`,
    subtitle: monthLabel,
    userName,
    logs,
    allMoods,
    periodDays: end.getDate(),
    intro: `Bản xuất này gom các check-in trong ${monthLabel}, kèm điểm mood, nguyên nhân, chỉ số phụ và số tệp đa phương tiện đã lưu.`,
    statItems: [
      { label: 'Ngày có ghi chú', value: `${stats.uniqueDays}/${end.getDate()}` },
      { label: 'Tổng ghi chú', value: `${stats.totalEntries}` },
      { label: 'Mood trung bình', value: `${stats.avgScore}/5` },
      { label: 'Tệp đã lưu', value: `${stats.mediaCount}` },
      { label: 'Tỉ lệ check-in', value: stats.checkinRate },
      { label: 'Phổ biến nhất', value: stats.mostFreq ? `${stats.mostFreq.label}` : 'N/A' },
    ],
  });
}

async function buildAllDocument({ userName, moodLogs, allMoods }) {
  if (!moodLogs.length) return null;
  const sortedLogs = [...moodLogs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const firstDate = new Date(sortedLogs[0].date);
  const lastDate = new Date(sortedLogs[sortedLogs.length - 1].date);
  const months = new Set(sortedLogs.map(log => {
    const date = new Date(log.date);
    return `${date.getFullYear()}-${date.getMonth()}`;
  }));
  const stats = buildStats(sortedLogs, allMoods);

  return await buildDocument({
    title: 'Toàn bộ nhật ký cảm xúc',
    subtitle: `${format(firstDate, 'dd/MM/yyyy')} - ${format(lastDate, 'dd/MM/yyyy')}`,
    userName,
    logs: sortedLogs,
    allMoods,
    intro: 'Bản xuất này tổng hợp toàn bộ lịch sử check-in của bạn theo định dạng đọc được, có phân trang và tóm tắt riêng.',
    statItems: [
      { label: 'Tổng ghi chú', value: `${stats.totalEntries}` },
      { label: 'Ngày có ghi chú', value: `${stats.uniqueDays}` },
      { label: 'Mood trung bình', value: `${stats.avgScore}/5` },
      { label: 'Tệp đã lưu', value: `${stats.mediaCount}` },
      { label: 'Số tháng', value: `${months.size}` },
      { label: 'Phổ biến nhất', value: stats.mostFreq ? `${stats.mostFreq.label}` : 'N/A' },
    ],
  });
}

const DOCUMENT_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #e8ecf7; color: #172033; font-family: "Segoe UI", Arial, sans-serif; }
  .pdf-root { width: ${PAGE_WIDTH}px; }
  .pdf-page {
    width: ${PAGE_WIDTH}px;
    min-height: ${PAGE_HEIGHT}px;
    padding: 42px 46px 34px;
    background: #f8f9ff;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }
  .page-header {
    border-radius: 22px;
    background: linear-gradient(135deg, #4f63d7 0%, #188b79 100%);
    color: white;
    padding: 28px 30px;
    display: flex;
    justify-content: space-between;
    gap: 24px;
    min-height: 148px;
    box-shadow: 0 16px 32px rgba(49, 72, 150, 0.22);
  }
  .page-header.compact { min-height: auto; padding: 20px 24px; border-radius: 18px; }
  .page-header span { display: block; font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.82; }
  .page-header h1 { margin: 8px 0 8px; font-size: 28px; line-height: 1.15; }
  .page-header.compact h1 { font-size: 22px; }
  .page-header p { margin: 0; font-size: 13px; line-height: 1.45; opacity: 0.9; }
  .export-meta { text-align: right; min-width: 170px; align-self: flex-start; }
  .export-meta strong { display: block; font-size: 14px; margin-bottom: 6px; }
  main { flex: 1; padding-top: 24px; }
  h2 { margin: 0 0 12px; font-size: 18px; color: #222b45; }
  .summary-card, .summary-note, .empty-state {
    border: 1px solid #dbe2f6;
    border-radius: 18px;
    background: white;
    padding: 20px;
    margin-bottom: 18px;
    box-shadow: 0 10px 28px rgba(42, 52, 89, 0.06);
  }
  .summary-card p { margin: 0 0 16px; color: #5c6682; line-height: 1.55; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .stat-card { border-radius: 14px; background: #f1f4ff; border: 1px solid #dfe6ff; padding: 13px; min-height: 76px; }
  .stat-card span { display: block; color: #62708f; font-size: 11px; font-weight: 800; text-transform: uppercase; }
  .stat-card strong { display: block; margin-top: 8px; color: #3342a0; font-size: 20px; line-height: 1.15; }
  .distribution { display: grid; gap: 8px; }
  .distribution-row { display: grid; grid-template-columns: minmax(0, 1fr) 78px 48px; align-items: center; gap: 12px; border-radius: 12px; background: #f7f8fd; padding: 10px 12px; }
  .distribution-row div { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .distribution-row i { width: 10px; height: 10px; border-radius: 999px; flex: 0 0 auto; }
  .distribution-row span { overflow-wrap: anywhere; }
  .distribution-row strong, .distribution-row em { color: #4f5ca8; font-size: 12px; font-style: normal; text-align: right; }
  .summary-note { display: grid; gap: 6px; border-left: 5px solid #55efc4; }
  .summary-note strong { color: #173c36; font-size: 16px; }
  .summary-note span, .muted { color: #66708a; line-height: 1.5; }
  .table-wrap {
    border: 1px solid #dce3f5;
    border-radius: 16px;
    background: white;
    overflow: hidden;
    box-shadow: 0 8px 22px rgba(42, 52, 89, 0.06);
  }
  .detail-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .detail-table th {
    background: #eef2ff;
    color: #37408f;
    font-size: 11px;
    letter-spacing: 0.02em;
    padding: 10px 9px;
    text-align: left;
    text-transform: uppercase;
  }
  .detail-table td {
    border-top: 1px solid #e4e9f8;
    color: #2f3a56;
    font-size: 11.5px;
    line-height: 1.42;
    padding: 10px 9px;
    vertical-align: top;
  }
  .detail-table tr:nth-child(even) td { background: #fafbff; }
  .detail-table tr td:first-child { border-left: 4px solid var(--mood-color); }
  .col-time { width: 92px; }
  .col-mood { width: 112px; }
  .col-meta { width: 170px; }
  .col-note { width: auto; }
  .col-time strong,
  .col-time span,
  .col-mood b,
  .col-mood span {
    display: block;
  }
  .col-time strong { color: #27314c; font-size: 11px; }
  .col-time span { color: #64708f; font-size: 12px; font-weight: 900; margin-top: 4px; }
  .col-mood b { color: #172033; font-size: 12px; margin-bottom: 5px; overflow-wrap: anywhere; }
  .col-mood span {
    border-radius: 999px;
    background: #eef2ff;
    color: #4f5ca8;
    font-size: 10px;
    font-weight: 900;
    padding: 3px 7px;
    width: fit-content;
  }
  .col-meta p { margin: 0 0 7px; color: #61708d; font-size: 10.5px; font-weight: 700; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 7px; }
  .tags i { border-radius: 999px; background: #eef2ff; color: #4f5ca8; font-size: 9.5px; font-style: normal; font-weight: 800; padding: 3px 6px; }
  .note-rich { color: #2f3a56; overflow-wrap: anywhere; }
  .note-line { margin: 0 0 5px; white-space: pre-wrap; }
  .note-line strong,
  .note-heading strong,
  .note-quote strong,
  .note-check strong { font-weight: 900; color: #172033; }
  .note-line u,
  .note-heading u,
  .note-quote u,
  .note-check u { text-decoration: underline; text-underline-offset: 2px; }
  .note-heading {
    color: #1f2a44;
    font-weight: 900;
    margin: 0 0 6px;
  }
  .note-heading.level-1 { font-size: 14px; }
  .note-heading.level-2 { font-size: 13px; }
  .note-heading.level-3 { font-size: 12px; }
  .note-check {
    display: grid;
    grid-template-columns: 13px 1fr;
    gap: 5px;
    margin: 0 0 5px;
  }
  .note-check i {
    border: 1px solid #9aa6c8;
    border-radius: 3px;
    color: #188b79;
    display: grid;
    font-size: 9px;
    font-style: normal;
    font-weight: 900;
    height: 12px;
    line-height: 1;
    place-items: center;
    width: 12px;
  }
  .note-check.checked span { color: #56627e; }
  .note-quote {
    border-left: 3px solid #a29bfe;
    color: #4f5ca8;
    font-style: italic;
    margin: 0 0 6px;
    padding-left: 8px;
  }
  .note-space { height: 5px; }
  .gallery-wrap {
    border: 1px solid #dce3f5;
    border-radius: 18px;
    background: white;
    padding: 14px;
    box-shadow: 0 8px 22px rgba(42, 52, 89, 0.06);
  }
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .gallery-item {
    border: 1px solid #e1e7f7;
    border-radius: 14px;
    background: #fafbff;
    margin: 0;
    overflow: hidden;
  }
  .gallery-item img {
    width: 100%;
    aspect-ratio: 4 / 3;
    display: block;
    object-fit: cover;
    background: #eef2ff;
  }
  .gallery-item figcaption {
    display: grid;
    gap: 3px;
    padding: 9px;
  }
  .gallery-item figcaption strong {
    color: #27314c;
    font-size: 11px;
  }
  .gallery-item figcaption span {
    color: #64708f;
    font-size: 10.5px;
    font-weight: 800;
    overflow-wrap: anywhere;
  }
  footer { border-top: 1px solid #dce3f5; color: #7a849d; display: flex; justify-content: space-between; padding-top: 12px; font-size: 11px; }
`;

function waitForImages(root) {
  const images = Array.from(root.querySelectorAll('img'));
  if (!images.length) return Promise.resolve();
  return Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      const timeout = window.setTimeout(resolve, 3500);
      img.onload = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      img.onerror = () => {
        window.clearTimeout(timeout);
        resolve();
      };
    });
  }));
}

async function renderToPDF(documentHtml, filename) {
  const container = document.createElement('div');
  container.className = 'pdf-root';
  container.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1';
  container.innerHTML = `<style>${DOCUMENT_STYLES}</style>${documentHtml}`;
  document.body.appendChild(container);

  try {
    const pages = Array.from(container.querySelectorAll('.pdf-page'));
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let index = 0; index < pages.length; index += 1) {
      await waitForImages(pages[index]);
      const canvas = await html2canvas(pages[index], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8f9ff',
        windowWidth: PAGE_WIDTH,
        windowHeight: PAGE_HEIGHT,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      if (index > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportMoodPDF({ userName, moodLogs, month, year, allMoods }) {
  const documentData = await buildMonthDocument({ userName, moodLogs, month, year, allMoods });
  await renderToPDF(documentData.html, `MindBuddy_T${month + 1}-${year}.pdf`);
}

export async function exportAllMoodPDF({ userName, moodLogs, allMoods }) {
  const documentData = await buildAllDocument({ userName, moodLogs, allMoods });
  if (!documentData) return;
  await renderToPDF(documentData.html, `MindBuddy_ToanBo_${format(new Date(), 'ddMMyyyy')}.pdf`);
}
