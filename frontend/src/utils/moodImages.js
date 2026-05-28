function kindForType(type = '') {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'file';
}

function normalizeAttachment(attachment, index = 0) {
  if (!attachment?.url) return null;
  return {
    url: attachment.url,
    path: attachment.path || '',
    name: attachment.name || `Tệp check-in ${index + 1}`,
    size: attachment.size || 0,
    type: attachment.type || '',
    kind: attachment.kind || kindForType(attachment.type || ''),
  };
}

export function normalizeMoodAttachments(logOrAttachments) {
  if (!logOrAttachments) return [];

  if (Array.isArray(logOrAttachments)) {
    return logOrAttachments
      .map((attachment, index) => normalizeAttachment(attachment, index))
      .filter(Boolean);
  }

  const log = logOrAttachments;
  if (Array.isArray(log.attachments) && log.attachments.length > 0) {
    return normalizeMoodAttachments(log.attachments);
  }
  if (Array.isArray(log.images) && log.images.length > 0) {
    return normalizeMoodAttachments(log.images);
  }
  if (log.image?.url) return normalizeMoodAttachments([{ ...log.image, kind: 'image' }]);
  if (log.imageUrl) {
    return normalizeMoodAttachments([{
      url: log.imageUrl,
      path: log.imagePath || '',
      name: 'Ảnh check-in',
      kind: 'image',
      type: 'image/jpeg',
    }]);
  }
  return [];
}

export function normalizeMoodImages(logOrImages) {
  return normalizeMoodAttachments(logOrImages).filter(attachment => attachment.kind === 'image');
}

export function firstMoodImage(logOrImages) {
  return normalizeMoodImages(logOrImages)[0] || null;
}

export function firstMoodAttachment(logOrAttachments) {
  return normalizeMoodAttachments(logOrAttachments)[0] || null;
}

export function shortAttachmentKind(kind = 'file') {
  if (kind === 'image') return 'Ảnh';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Ghi âm';
  return 'Tệp';
}

function shortDateTime(value) {
  if (!value) return '';
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hour}:${minute}`;
}

export function displayAttachmentName(attachment, options = {}) {
  const kind = attachment?.kind || kindForType(attachment?.type || '');
  const label = shortAttachmentKind(kind);
  const datePart = shortDateTime(options.date);
  const indexPart = Number.isFinite(options.index) && options.total > 1 ? ` ${options.index + 1}` : '';
  return `${label}${indexPart} check-in${datePart ? ` ${datePart}` : ''}`;
}
