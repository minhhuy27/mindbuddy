import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
  AUDIO_RECORDING_LIMIT,
  getBestAudioMimeType,
  getAudioExtension,
} from './constants';

export default function useMoodMedia() {
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [mediaDropActive, setMediaDropActive] = useState(false);
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const imageInputRef = useRef(null);
  const imagePreviewsRef = useRef([]);
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const mediaDropDepthRef = useRef(0);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const stopRecordingStream = useCallback(() => {
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    recordingStreamRef.current = null;
  }, []);

  const discardActiveRecording = useCallback(() => {
    clearRecordingTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    stopRecordingStream();
    setRecordingState('idle');
    setRecordingSeconds(0);
  }, [clearRecordingTimer, stopRecordingStream]);

  const addRecordedAudio = (file) => {
    const preview = {
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    };
    setImageFiles(prev => [...prev, file]);
    setImagePreviews(prev => [...prev, preview]);
    setRemoveExistingImage(false);
  };

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => () => {
    imagePreviewsRef.current.forEach(item => URL.revokeObjectURL(item.url));
    clearRecordingTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    stopRecordingStream();
  }, [clearRecordingTimer, stopRecordingStream]);

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    setImageError('');
    if (!files.length) return;
    const invalid = files.find(file => !file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/'));
    if (invalid) {
      setImageError('Chỉ hỗ trợ ảnh, video hoặc tệp âm thanh.');
      return;
    }
    const tooLarge = files.find(file => (
      (file.type.startsWith('image/') && file.size > 8 * 1024 * 1024) ||
      (file.type.startsWith('audio/') && file.size > 25 * 1024 * 1024) ||
      (file.type.startsWith('video/') && file.size > 100 * 1024 * 1024)
    ));
    if (tooLarge) {
      setImageError('Dung lượng tối đa: ảnh 8MB, audio 25MB, video 100MB.');
      return;
    }
    const largeVideo = files.find(file => file.type.startsWith('video/') && file.size > 50 * 1024 * 1024);
    if (largeVideo) {
      setImageError('Video trên 50MB có thể làm đầy Firebase nhanh. MindBuddy sẽ thử nén qua backend, nhưng bạn nên dùng video ngắn nếu có thể.');
    }
    const previews = files.map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...previews]);
    setRemoveExistingImage(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const extractMediaFiles = (source) => {
    const itemFiles = Array.from(source?.items || [])
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean);
    const directFiles = Array.from(source?.files || []);
    return [...itemFiles, ...directFiles].filter((file, index, files) => (
      files.findIndex(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified) === index
    ));
  };

  const hasMediaItems = (source) => (
    Array.from(source?.items || []).some(item => item.kind === 'file') ||
    Array.from(source?.files || []).length > 0
  );

  const addMediaFilesFromExternalSource = (files) => {
    if (recordingState !== 'idle') {
      setImageError('Vui lòng dừng ghi âm trước khi thêm tệp khác.');
      return;
    }
    handleImageSelect({ target: { files } });
  };

  const handleMediaDragEnter = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    mediaDropDepthRef.current += 1;
    setMediaDropActive(true);
  };

  const handleMediaDragOver = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = recordingState === 'idle' ? 'copy' : 'none';
    setMediaDropActive(true);
  };

  const handleMediaDragLeave = (event) => {
    event.preventDefault();
    mediaDropDepthRef.current = Math.max(0, mediaDropDepthRef.current - 1);
    if (mediaDropDepthRef.current === 0) setMediaDropActive(false);
  };

  const handleMediaDrop = (event) => {
    if (!hasMediaItems(event.dataTransfer)) return;
    event.preventDefault();
    mediaDropDepthRef.current = 0;
    setMediaDropActive(false);
    addMediaFilesFromExternalSource(extractMediaFiles(event.dataTransfer));
  };

  const handleMediaPaste = (event) => {
    const files = extractMediaFiles(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    addMediaFilesFromExternalSource(files);
  };

  const removeSelectedImage = (index) => {
    setImagePreviews(prev => {
      const target = prev[index];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeExistingImageAt = (index) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
    setRemoveExistingImage(true);
  };

  function stopAudioRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      discardActiveRecording();
      return;
    }
    setRecordingState('stopping');
    recorder.stop();
  }

  const startAudioRecording = async () => {
    setImageError('');
    if (recordingState !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof window === 'undefined' || !window.MediaRecorder) {
      setImageError('Trình duyệt này chưa hỗ trợ ghi âm trực tiếp. Bạn có thể chọn tệp audio có sẵn.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getBestAudioMimeType();
      const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        clearRecordingTimer();
        const finalType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: finalType });
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopRecordingStream();
        setRecordingState('idle');
        setRecordingSeconds(0);

        if (!blob.size) {
          setImageError('Bản ghi âm quá ngắn hoặc micro chưa cấp dữ liệu.');
          return;
        }
        if (blob.size > 25 * 1024 * 1024) {
          setImageError('File ghi âm vượt 25MB. Hãy thử ghi ngắn hơn hoặc chọn tệp đã nén.');
          return;
        }

        const extension = getAudioExtension(finalType);
        const file = new File([blob], `mindbuddy-ghi-am-${format(new Date(), 'yyyyMMdd-HHmmss')}.${extension}`, {
          type: finalType,
          lastModified: Date.now(),
        });
        addRecordedAudio(file);
      };

      recorder.onerror = () => {
        clearRecordingTimer();
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stopRecordingStream();
        setRecordingState('idle');
        setRecordingSeconds(0);
        setImageError('Không thể ghi âm. Hãy kiểm tra quyền micro của trình duyệt.');
      };

      recorder.start(1000);
      setRecordingState('recording');
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          const next = prev + 1;
          if (next >= AUDIO_RECORDING_LIMIT) {
            window.setTimeout(() => stopAudioRecording(), 0);
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error('Audio recording error:', error);
      clearRecordingTimer();
      recordingChunksRef.current = [];
      mediaRecorderRef.current = null;
      stopRecordingStream();
      setRecordingState('idle');
      setRecordingSeconds(0);
      setImageError('Không truy cập được micro. Hãy cho phép quyền micro rồi thử lại.');
    }
  };

  const resetMedia = () => {
    discardActiveRecording();
    imagePreviews.forEach(item => URL.revokeObjectURL(item.url));
    setImageFiles([]);
    setImagePreviews([]);
    setExistingImages([]);
    setRemoveExistingImage(false);
    setImageError('');
    setMediaDropActive(false);
    mediaDropDepthRef.current = 0;
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const loadExistingMedia = (attachments) => {
    setExistingImages(attachments);
    imagePreviews.forEach(item => URL.revokeObjectURL(item.url));
    setImageFiles([]);
    setImagePreviews([]);
    setRemoveExistingImage(false);
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return {
    imageFiles,
    imagePreviews,
    existingImages,
    removeExistingImage,
    imageError,
    setImageError,
    mediaDropActive,
    recordingState,
    recordingSeconds,
    imageInputRef,
    handleImageSelect,
    handleMediaDragEnter,
    handleMediaDragOver,
    handleMediaDragLeave,
    handleMediaDrop,
    handleMediaPaste,
    removeSelectedImage,
    removeExistingImageAt,
    startAudioRecording,
    stopAudioRecording,
    resetMedia,
    loadExistingMedia,
  };
}
