import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;
const UPLOAD_TIMEOUT_MS = 120000;

function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), UPLOAD_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function parseServerResponse(error) {
  const raw = error?.customData?.serverResponse;
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error?.message || parsed?.error?.status || raw;
  } catch {
    return raw;
  }
}

function storageErrorMessage(error) {
  const serverMessage = parseServerResponse(error);
  const details = [
    error?.code,
    serverMessage,
    error?.message,
  ].filter(Boolean).join(' - ');

  if (error?.code === 'storage/unauthorized') {
    return `Firebase Storage từ chối upload. Hãy kiểm tra Storage Rules. ${details}`;
  }
  if (error?.code === 'storage/bucket-not-found') {
    return `Không tìm thấy Firebase Storage bucket. Hãy kiểm tra storageBucket trong firebase.js. ${details}`;
  }
  if (error?.code === 'storage/retry-limit-exceeded') {
    return `Upload ảnh quá lâu hoặc mạng không ổn định. ${details}`;
  }
  if (error?.code === 'storage/unknown') {
    return `Firebase Storage báo lỗi không xác định. Chi tiết: ${details || 'không có phản hồi chi tiết từ server'}`;
  }
  return details || 'Không thể upload ảnh lên Firebase Storage.';
}

function userStorageKey(user) {
  return user?.uid || user?.email?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
}

function extensionFor(file) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'video/mp4') return 'mp4';
  if (file.type === 'video/webm') return 'webm';
  if (file.type === 'audio/mpeg') return 'mp3';
  if (file.type === 'audio/mp4') return 'm4a';
  if (file.type === 'audio/webm') return 'webm';
  if (file.type === 'audio/wav') return 'wav';
  const ext = file.name?.split('.').pop()?.toLowerCase();
  if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
  return 'jpg';
}

function kindFor(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function validateMediaFile(file) {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_SIZE) throw new Error('Mỗi ảnh tối đa 8MB. Hãy chọn ảnh nhỏ hơn.');
    return;
  }
  if (file.type.startsWith('audio/')) {
    if (file.size > MAX_AUDIO_SIZE) throw new Error('Mỗi tệp âm thanh tối đa 25MB.');
    return;
  }
  if (file.type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_SIZE) throw new Error('Mỗi video tối đa 100MB.');
    return;
  }
  throw new Error('Chỉ hỗ trợ ảnh, video hoặc tệp âm thanh.');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh này.'));
    };
    img.src = url;
  });
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Vui lòng chọn một file ảnh.');
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Ảnh tối đa 8MB. Hãy chọn ảnh nhỏ hơn.');
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? JPEG_QUALITY : undefined);
  });
  if (!blob) throw new Error('Không thể nén ảnh này.');
  return blob;
}

export async function uploadMoodFile({ file, user, namespace = 'mood-checkins' }) {
  validateMediaFile(file);
  const isImage = file.type.startsWith('image/');
  const blob = isImage ? await compressImage(file) : file;
  const ext = extensionFor(file);
  const safeUser = userStorageKey(user);
  const path = `${namespace}/${safeUser}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const imageRef = ref(storage, path);
  try {
    await withTimeout(
      uploadBytes(imageRef, blob, {
        contentType: blob.type || file.type || 'image/jpeg',
      }),
      'Upload ảnh quá lâu. Hãy kiểm tra Firebase Storage hoặc kết nối mạng.'
    );
    const url = await withTimeout(
      getDownloadURL(imageRef),
      'Không lấy được đường dẫn ảnh từ Firebase Storage.'
    );
    return {
      url,
      path,
      name: file.name || 'Tệp check-in',
      size: blob.size,
      type: blob.type || file.type || 'application/octet-stream',
      kind: kindFor(file),
    };
  } catch (error) {
    console.error('Firebase Storage upload failed:', {
      code: error?.code,
      message: error?.message,
      serverResponse: error?.customData?.serverResponse,
      bucket: storage.app?.options?.storageBucket,
      path,
    });
    throw new Error(storageErrorMessage(error));
  }
}

export async function uploadMoodImage({ file, user, namespace = 'mood-checkins' }) {
  return uploadMoodFile({ file, user, namespace });
}

export async function uploadMoodImages({ files, user, namespace = 'mood-checkins' }) {
  const list = Array.from(files || []);
  if (!list.length) return [];
  return Promise.all(list.map(file => uploadMoodFile({ file, user, namespace })));
}

export async function uploadMoodFiles({ files, user, namespace = 'mood-checkins' }) {
  return uploadMoodImages({ files, user, namespace });
}
