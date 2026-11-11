import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useApp } from '../../context/AppContext';
import { analyzeMood, createChat, detectDanger, summarizeDay } from '../../utils/aiService';
import { exportMoodPDF as exportMoodPDFBase, exportAllMoodPDF as exportAllMoodPDFBase } from '../../utils/exportPDF';
import { uploadMoodFiles } from '../../utils/imageUpload';
import { displayAttachmentName } from '../../utils/moodImages';
import CrisisPanel from '../../components/CrisisPanel';
import {
  CAUSE_TAG_SCHEMA_VERSION,
  DEFAULT_CAUSES,
  DEFAULT_METRICS,
  VISUAL_CAUSES,
  attachmentSearchText,
  cleanLogNote,
  extractLogCauses,
  groupByDay,
  logAttachments,
  metricValue,
  normalizeMetrics,
  normalizeSearchText,
  normalizeTab,
} from './constants';
import useMoodMedia from './useMoodMedia';
import CustomMoodModal from './CustomMoodModal';
import MoodSelector from './MoodSelector';
import CauseTagPicker from './CauseTagPicker';
import MetricsPanel from './MetricsPanel';
import MoodNoteEditor from './MoodNoteEditor';
import MoodInsight from './MoodInsight';
import MoodHistory from './MoodHistory';
import MoodExport from './MoodExport';
import DayDetailModal from './DayDetailModal';
import PhotoLightbox from './PhotoLightbox';
import './MoodTracker.css';

export default function MoodTracker() {
  const {
    MOODS, customMoods, moodLogs,
    addMoodLog, updateMoodLog, deleteMoodLog, toggleMoodLogPinned,
    addCustomMood, deleteCustomMood,
    user, todayAI, saveTodayAI, aiMemory, saveAiMemory, userGoal, currentGoal,
    causeOptions, saveCauseOptions,
  } = useApp();

  // Tất cả moods = built-in + custom
  const allMoods = [...MOODS, ...(customMoods || [])];

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => normalizeTab(searchParams.get('tab')));
  const selectTab = React.useCallback((tab) => {
    const next = normalizeTab(tab);
    setActiveTab(next);
    setSearchParams(next === 'today' ? {} : { tab: next }, { replace: true });
  }, [setSearchParams]);
  const todayDraftKey = React.useMemo(() => {
    const uid = user?.uid || user?.email || 'guest';
    return `mb_mood_draft_${uid}_${format(new Date(), 'yyyy-MM-dd')}`;
  }, [user?.uid, user?.email]);

  // Form state
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');
  const [causes, setCauses] = useState([]);
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [checkinFeedback, setCheckinFeedback] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [showNoteIcons, setShowNoteIcons] = useState(false);
  const [excludeFromAI, setExcludeFromAI] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState(null);

  const noteTextareaRef = React.useRef(null);
  const quickActionHandledRef = React.useRef('');
  const startAudioRecordingRef = React.useRef(null);

  const media = useMoodMedia();
  startAudioRecordingRef.current = media.startAudioRecording;
  const mediaRef = React.useRef(media);
  mediaRef.current = media;

  // Custom mood modal
  const [showModal, setShowModal] = useState(false);

  // AI state
  const todayAIData = todayAI?.date === new Date().toDateString() ? todayAI : null;
  const [aiAdvice, setAiAdvice] = useState(todayAIData?.advice || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [lastAnalysisRequest, setLastAnalysisRequest] = useState(null);
  const [aiPreview, setAiPreview] = useState(null);
  const [aiPreviewStatus, setAiPreviewStatus] = useState('');
  const [chatMessages, setChatMessages] = useState(todayAIData?.chatMessages || []);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [failedChatMessage, setFailedChatMessage] = useState('');
  const [showSOS, setShowSOS] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatFnRef = React.useRef(null);
  const chatEndRef = React.useRef(null);
  const aiMemoryRef = React.useRef(aiMemory);
  aiMemoryRef.current = aiMemory;

  React.useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get('tab')));
  }, [searchParams]);

  // Export state
  const now = new Date();
  const [exportMonth, setExportMonth] = useState(now.getMonth());
  const [exportYear, setExportYear] = useState(now.getFullYear());
  const [exportOptions, setExportOptions] = useState({
    privacy: 'all',
    range: 'selected',
    detail: 'full',
    includeImages: true,
  });
  const [exporting, setExporting] = useState(false); // 'month' | 'all' | false
  const exportMoodPDF = React.useCallback((payload) => (
    exportMoodPDFBase({ ...payload, options: exportOptions })
  ), [exportOptions]);
  const exportAllMoodPDF = React.useCallback((payload) => (
    exportAllMoodPDFBase({ ...payload, options: exportOptions })
  ), [exportOptions]);
  const [historyRange, setHistoryRange] = useState(14);
  const [historyFilters, setHistoryFilters] = useState({
    search: '',
    mood: 'all',
    cause: 'all',
    media: 'all',
    stressHigh: false,
    sleepLow: false,
    from: '',
    to: '',
  });
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const activeCauses = React.useMemo(() => (
    Array.isArray(causeOptions) ? causeOptions : DEFAULT_CAUSES
  ), [causeOptions]);

  React.useEffect(() => {
    if (!user || !Array.isArray(causeOptions)) return;
    const userKey = user.uid || user.email || 'guest';
    const storageKey = `mb_cause_tags_seeded_${CAUSE_TAG_SCHEMA_VERSION}_${userKey}`;

    try {
      if (localStorage.getItem(storageKey) === '1') return;
    } catch (error) {
      void error;
      return;
    }

    const normalized = causeOptions.map(c => String(c || '').trim()).filter(Boolean);
    const normalizedLower = new Set(normalized.map(c => c.toLowerCase()));
    const missing = VISUAL_CAUSES.filter(c => !normalizedLower.has(c.toLowerCase()));

    if (!missing.length) {
      try { localStorage.setItem(storageKey, '1'); } catch (error) { void error; }
      return;
    }

    saveCauseOptions([...normalized, ...missing])
      .then(() => {
        try { localStorage.setItem(storageKey, '1'); } catch (error) { void error; }
      })
      .catch(error => { void error; });
  }, [causeOptions, saveCauseOptions, user]);

  const viewedMonth = new Date(exportYear, exportMonth, 1);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonthSelected = viewedMonth.getTime() === currentMonth.getTime();
  const isAtOrAfterCurrentMonth = viewedMonth.getTime() >= currentMonth.getTime();
  const hasMetricDraft = Object.keys(DEFAULT_METRICS).some(key => metrics[key] !== DEFAULT_METRICS[key]);
  const hasImageDraft = media.imageFiles.length > 0;
  const hasDraftContent = !editingId && (!!selected || note.trim().length > 0 || causes.length > 0 || hasMetricDraft || hasImageDraft);

  const moveCalendarMonth = (offset) => {
    const next = new Date(exportYear, exportMonth + offset, 1);
    const capped = next > currentMonth ? currentMonth : next;
    setExportMonth(capped.getMonth());
    setExportYear(capped.getFullYear());
  };

  const resetCalendarMonth = () => {
    setExportMonth(now.getMonth());
    setExportYear(now.getFullYear());
  };

  const updateHistoryFilter = (key, value) => {
    setHistoryFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetHistoryFilters = () => {
    setHistoryFilters({
      search: '',
      mood: 'all',
      cause: 'all',
      media: 'all',
      stressHigh: false,
      sleepLow: false,
      from: '',
      to: '',
    });
  };

  React.useEffect(() => {
    const activeTodayAI = todayAI?.date === new Date().toDateString() ? todayAI : null;
    if (activeTodayAI?.advice && activeTodayAI?.moodLabel) {
      chatFnRef.current = createChat(
        activeTodayAI.advice,
        activeTodayAI.moodLabel,
        activeTodayAI.chatMessages || [],
        aiMemoryRef.current || [],
        currentGoal?.label || userGoal
      );
      setAiAdvice(activeTodayAI.advice);
      setChatMessages(activeTodayAI.chatMessages || []);
    }
  }, [todayAI, userGoal, currentGoal?.label]);

  React.useEffect(() => {
    setDraftReady(false);
    setDraftStatus('');
    try {
      const raw = localStorage.getItem(todayDraftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        setSelected(draft.selected || null);
        setNote(draft.note || '');
        setCauses(Array.isArray(draft.causes) ? draft.causes : []);
        setMetrics(normalizeMetrics(draft.metrics));
        setExcludeFromAI(!!draft.excludeFromAI);
        setDraftStatus('Đã khôi phục nháp hôm nay.');
      } else {
        setSelected(null);
        setNote('');
        setCauses([]);
        setMetrics(DEFAULT_METRICS);
        setExcludeFromAI(false);
      }
    } catch {
      localStorage.removeItem(todayDraftKey);
    } finally {
      setDraftReady(true);
    }
  }, [todayDraftKey]);

  React.useEffect(() => {
    if (!draftReady || editingId) return undefined;

    const timeout = window.setTimeout(() => {
      if (!selected && !note.trim() && causes.length === 0 && !hasMetricDraft) {
        localStorage.removeItem(todayDraftKey);
        setDraftStatus('');
        return;
      }

      localStorage.setItem(todayDraftKey, JSON.stringify({
        selected,
        note,
        causes,
        metrics,
        excludeFromAI,
        savedAt: Date.now(),
      }));
      setDraftStatus('Đã tự lưu nháp.');
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [selected, note, causes, metrics, excludeFromAI, hasMetricDraft, media.imageFiles, editingId, draftReady, todayDraftKey]);

  // Tự động tóm tắt ngày hôm qua nếu chưa có trong memory
  React.useEffect(() => {
    const autoSummarizeYesterday = async () => {
      const yesterday = subDays(new Date(), 1);
      const yesterdayStr = yesterday.toDateString();
      const yesterdayLabel = format(yesterday, 'dd/MM/yyyy');

      // Kiểm tra đã có trong memory chưa
      const alreadySaved = (aiMemory || []).some(e => e.date === yesterdayLabel);
      if (alreadySaved) return;

      // Lấy logs của hôm qua
      const yesterdayLogs = moodLogs.filter(
        l => !l.excludeFromAI && new Date(l.date).toDateString() === yesterdayStr
      );
      if (yesterdayLogs.length === 0) return;

      // Build entries để gửi lên summarize
      const entries = yesterdayLogs.map(l => {
        const mood = allMoods.find(m => m.id === l.mood);
        const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
        const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
        return {
          moodLabel: mood?.label || 'Không rõ',
          note: cleanNote,
          causes: causesInNote,
          metrics: l.metrics,
        };
      });

      const moods = entries.map(e => e.moodLabel);
      const summary = await summarizeDay({ date: yesterdayLabel, entries });

      if (summary) {
        saveAiMemory({ date: yesterdayLabel, summary, moods });
      } else {
        // Fallback: lưu không có summary text
        saveAiMemory({ date: yesterdayLabel, summary: '', moods });
      }
    };

    if (moodLogs.length > 0) {
      autoSummarizeYesterday();
    }
  }, [moodLogs.length]); // eslint-disable-line

  const toggleCause = (c) => setCauses(prev =>
    prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
  );

  const updateMetric = (id, value) => {
    setMetrics(prev => ({ ...prev, [id]: Number(value) }));
  };

  const resetForm = () => {
    setSelected(null);
    setNote('');
    setCauses([]);
    setMetrics(DEFAULT_METRICS);
    setExcludeFromAI(false);
    setEditingId(null);
    setShowNoteIcons(false);
    media.resetMedia();
  };

  React.useEffect(() => {
    const quickAction = searchParams.get('quick');
    if (!quickAction) {
      quickActionHandledRef.current = '';
      return undefined;
    }

    const quickToken = searchParams.toString();
    if (quickActionHandledRef.current === quickToken) return undefined;
    quickActionHandledRef.current = quickToken;
    setActiveTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const timer = window.setTimeout(() => {
      if (quickAction === 'private') {
        setExcludeFromAI(true);
        setCheckinFeedback('Đang viết note riêng tư. Dòng này sẽ không được gửi cho AI.');
        noteTextareaRef.current?.focus();
      } else if (quickAction === 'media') {
        mediaRef.current.setImageError('');
        setCheckinFeedback('Chọn ảnh/video hoặc kéo thả tệp vào khung check-in.');
        mediaRef.current.imageInputRef.current?.click();
      } else if (quickAction === 'audio') {
        setCheckinFeedback('Đang mở ghi âm nhanh.');
        startAudioRecordingRef.current?.();
      } else {
        noteTextareaRef.current?.focus();
      }

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('quick');
      setSearchParams(nextParams, { replace: true });
      window.setTimeout(() => setCheckinFeedback(''), 3600);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams]);

  const openPhotoLightbox = (image, label, galleryItems = [], index = 0) => {
    if (!image?.url) return;
    const items = (Array.isArray(galleryItems) && galleryItems.length ? galleryItems : [image])
      .filter(item => item?.url && item.kind === 'image');
    if (!items.length) return;
    const safeIndex = Number.isFinite(index) && index >= 0 ? Math.min(index, items.length - 1) : 0;
    setPhotoLightbox({
      items,
      index: safeIndex,
      name: displayAttachmentName(items[safeIndex] || image),
      label: label || 'Ảnh check-in',
    });
  };

  const closePhotoLightbox = React.useCallback(() => {
    setPhotoLightbox(null);
  }, []);

  const movePhotoLightbox = React.useCallback((direction) => {
    setPhotoLightbox(current => {
      if (!current?.items?.length || current.items.length < 2) return current;
      const nextIndex = (current.index + direction + current.items.length) % current.items.length;
      return { ...current, index: nextIndex };
    });
  }, []);

  const clearDraft = () => {
    localStorage.removeItem(todayDraftKey);
    resetForm();
    setDraftStatus('Đã xóa nháp.');
    window.setTimeout(() => setDraftStatus(''), 1800);
  };

  const startEdit = (log) => {
    const causesInNote = log.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
    const cleanNote = log.note?.replace(/\s*\[.+\]$/, '') || '';
    setSelected(log.mood);
    setNote(cleanNote);
    setCauses(causesInNote);
    setMetrics(normalizeMetrics(log.metrics));
    setExcludeFromAI(!!log.excludeFromAI);
    media.loadExistingMedia(logAttachments(log));
    setEditingId(log.id);
    selectTab('today');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runMoodAnalysis = async (request) => {
    setAiLoading(true);
    setAiError('');
    setAiPreview(null);
    setAiPreviewStatus('');
    setAiAdvice('');
    setChatMessages([]);
    chatFnRef.current = null;
    setLastAnalysisRequest(request);
    try {
      const advice = await analyzeMood({
        moodLabel: request.moodLabel,
        note: request.note,
        causes: request.causes,
        metrics: request.metrics,
        recentMoods: request.recentMoods,
        aiMemory: request.aiMemory,
        userGoal: request.userGoal,
      });

      if (!advice) {
        setAiError('MindBuddy AI chưa phản hồi được. Bạn có thể thử lại mà không cần ghi cảm xúc lại.');
        return;
      }

      setAiPreview({ advice, request });
      setAiPreviewStatus('AI đã tạo bản phân tích nháp. Bạn có thể lưu, ẩn hoặc tạo lại trước khi đưa vào Insight.');
      setChatOpen(false);
    } catch (err) {
      console.error('AI error:', err);
      setAiError('MindBuddy AI phản hồi quá lâu hoặc đang lỗi. Vui lòng thử lại sau.');
    } finally {
      setAiLoading(false);
    }
  };

  const saveAnalysisPreview = async () => {
    if (!aiPreview?.advice || !aiPreview?.request) return;
    const { advice, request } = aiPreview;
    setAiAdvice(advice);
    setChatMessages([]);
    setChatOpen(true);
    setChatError('');
    setFailedChatMessage('');
    chatFnRef.current = createChat(advice, request.moodLabel, [], request.aiMemory || [], request.userGoal);
    saveTodayAI({ advice, moodLabel: request.moodLabel, chatMessages: [] });
    setAiPreview(null);
    setAiPreviewStatus('Đã lưu phân tích AI vào Insight hôm nay.');
    window.setTimeout(() => setAiPreviewStatus(''), 2600);

    const todayLabel = format(new Date(), 'dd/MM/yyyy');
    const todayLogs = moodLogs
      .filter(l => !l.excludeFromAI && new Date(l.date).toDateString() === new Date().toDateString());
    const hasRequestLog = todayLogs.some(l => l.mood === request.moodId && l.note === request.fullNote);
    const logsForMemory = hasRequestLog
      ? todayLogs
      : [...todayLogs, {
        mood: request.moodId,
        note: request.fullNote,
        metrics: request.metrics,
        date: new Date().toISOString(),
      }];
    const entries = logsForMemory.map(l => {
      const m = allMoods.find(x => x.id === l.mood);
      const causesInNote = l.note?.match(/\[(.+)\]/)?.[1]?.split(', ') || [];
      const cleanNote = l.note?.replace(/\s*\[.+\]$/, '') || '';
      return { moodLabel: m?.label || 'Không rõ', note: cleanNote, causes: causesInNote, metrics: l.metrics };
    });
    const summary = await summarizeDay({ date: todayLabel, entries });
    if (summary !== null) {
      saveAiMemory({
        date: todayLabel,
        summary: summary || '',
        moods: entries.map(e => e.moodLabel),
      });
    }
  };

  const hideAnalysisPreview = () => {
    setAiPreview(null);
    setAiPreviewStatus('Đã ẩn phân tích AI. Check-in vẫn được giữ trong nhật ký.');
    window.setTimeout(() => setAiPreviewStatus(''), 2600);
  };

  const regenerateAnalysisPreview = () => {
    const request = aiPreview?.request || lastAnalysisRequest;
    if (request) runMoodAnalysis(request);
  };

  const handleSave = async () => {
    if (!selected || saving) return;
    if (media.recordingState !== 'idle') {
      media.setImageError('Hãy dừng ghi âm trước khi lưu check-in.');
      return;
    }
    setSaving(true);
    setSaveStatus('');
    media.setImageError('');
    const moodId = selected;
    const rawNote = note;
    const selectedCauses = causes;
    const mood = allMoods.find(m => m.id === moodId);
    const fullNote = rawNote + (selectedCauses.length ? ` [${selectedCauses.join(', ')}]` : '');
    if (detectDanger(fullNote)) setShowSOS(true);
    const currentMetrics = normalizeMetrics(metrics);

    try {
      let imagePayload;
      if (media.imageFiles.length > 0) {
        const uploadedImages = await uploadMoodFiles({
          files: media.imageFiles,
          user,
          onStatus: setSaveStatus,
        });
        imagePayload = editingId ? [...media.existingImages, ...uploadedImages] : uploadedImages;
      } else if (editingId && media.removeExistingImage) {
        imagePayload = media.existingImages.length ? media.existingImages : null;
      }

      setSaveStatus('Đang lưu check-in...');

      if (editingId) {
        await updateMoodLog(editingId, moodId, fullNote, currentMetrics, imagePayload, { excludeFromAI });
        setCheckinFeedback('Đã cập nhật ghi chú cảm xúc.');
        resetForm();
      } else {
        await addMoodLog(moodId, fullNote, currentMetrics, imagePayload || null, { excludeFromAI });
        setCheckinFeedback(imagePayload?.length
          ? 'Đã lưu cảm xúc cùng ảnh check-in.'
          : 'Đã lưu cảm xúc. Vườn, streak và huy hiệu của bạn đang được cập nhật.');
        resetForm();
      }
      window.setTimeout(() => setCheckinFeedback(''), 3200);
      setSaving(false);
      setSaveStatus('');
      if (excludeFromAI) {
        setCheckinFeedback('Đã lưu ghi chú riêng tư. MindBuddy sẽ không gửi dòng này cho AI.');
        window.setTimeout(() => setCheckinFeedback(''), 3600);
        return;
      }
      selectTab('insight');

      const recentMoods = moodLogs.filter(l => !l.excludeFromAI).slice(0, 7)
        .map(l => allMoods.find(m => m.id === l.mood))
        .filter(Boolean);
      await runMoodAnalysis({
        moodId,
        moodLabel: mood.label,
        note: rawNote,
        causes: selectedCauses,
        metrics: currentMetrics,
        fullNote,
        recentMoods,
        aiMemory: aiMemory || [],
        userGoal: currentGoal?.label || userGoal,
      });
    } catch (err) {
      console.error('Save mood image/check-in error:', err);
      media.setImageError(err.message || 'Không thể lưu ảnh check-in. Vui lòng thử lại.');
      setSaving(false);
      setSaveStatus('');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa ghi chú này?')) return;
    await deleteMoodLog(id);
    if (editingId === id) resetForm();
  };

  const handleDeleteCustomMood = async (moodId, e) => {
    e.stopPropagation();
    if (selected === moodId) setSelected(null);
    await deleteCustomMood(moodId);
  };

  const sendChat = async (retryMessage) => {
    const userMsg = (retryMessage || chatInput).trim();
    if (!userMsg || !chatFnRef.current || chatSending) return;
    if (!retryMessage) setChatInput('');
    setChatError('');
    setFailedChatMessage('');
    if (detectDanger(userMsg)) setShowSOS(true);
    const baseMessages = retryMessage
      ? chatMessages.filter((m, index) => !(index === chatMessages.length - 1 && m.role === 'user' && m.text === retryMessage))
      : chatMessages;
    const next = [...baseMessages, { role: 'user', text: userMsg }];
    setChatMessages(next);
    saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: next });
    setChatSending(true);
    try {
      const reply = await chatFnRef.current(userMsg);
      if (detectDanger(reply)) setShowSOS(true);
      const next2 = [...next, { role: 'ai', text: reply }];
      setChatMessages(next2);
      saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: next2 });
    } catch {
      setFailedChatMessage(userMsg);
      setChatError('MindBuddy AI phản hồi quá lâu hoặc đang lỗi. Tin nhắn của bạn chưa được gửi lại cho AI.');
    } finally {
      setChatSending(false);
    }
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleResetChat = () => {
    setChatMessages([]);
    setChatError('');
    setFailedChatMessage('');
    chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', [], aiMemory || [], currentGoal?.label || userGoal);
    saveTodayAI({ advice: aiAdvice, moodLabel: todayAI?.moodLabel || '', chatMessages: [] });
  };

  const handleToggleChat = () => {
    if (!chatFnRef.current) {
      chatFnRef.current = createChat(aiAdvice, todayAI?.moodLabel || '', chatMessages, aiMemory || [], currentGoal?.label || userGoal);
    }
    setChatOpen(o => !o);
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting('month');
    try {
      await exportMoodPDF({
        userName: user?.displayName || user?.email || 'Người dùng',
        moodLogs,
        month: exportMonth,
        year: exportYear,
        allMoods,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (exporting) return;
    setExporting('all');
    try {
      await exportAllMoodPDF({
        userName: user?.displayName || user?.email || 'Người dùng',
        moodLogs,
        allMoods,
      });
    } finally {
      setExporting(false);
    }
  };

  const availableHistoryCauses = React.useMemo(() => {
    const fromLogs = moodLogs.flatMap(log => extractLogCauses(log.note || ''));
    return Array.from(new Set([...activeCauses, ...fromLogs])).filter(Boolean);
  }, [activeCauses, moodLogs]);

  const hasAdvancedHistoryFilters = (
    !!historyFilters.search.trim() ||
    historyFilters.mood !== 'all' ||
    historyFilters.cause !== 'all' ||
    historyFilters.media !== 'all' ||
    historyFilters.stressHigh ||
    historyFilters.sleepLow ||
    !!historyFilters.from ||
    !!historyFilters.to
  );

  const matchesHistoryFilters = (log) => {
    const logDate = new Date(log.date);
    const attachments = logAttachments(log);
    const logCauses = extractLogCauses(log.note || '');
    const mood = allMoods.find(item => item.id === log.mood);
    const searchQuery = normalizeSearchText(historyFilters.search);

    if (searchQuery) {
      const dateLabels = [
        format(logDate, 'dd/MM/yyyy'),
        format(logDate, 'dd/MM'),
        format(logDate, 'yyyy-MM-dd'),
        format(logDate, 'EEEE dd/MM/yyyy', { locale: vi }),
        format(logDate, 'HH:mm dd/MM/yyyy'),
      ];
      const haystack = normalizeSearchText([
        log.note,
        cleanLogNote(log.note || ''),
        mood?.label,
        mood?.emoji,
        ...logCauses,
        ...dateLabels,
        ...attachments.map(attachmentSearchText),
      ].filter(Boolean).join(' '));
      if (!haystack.includes(searchQuery)) return false;
    }

    if (historyFilters.from) {
      const fromDate = new Date(`${historyFilters.from}T00:00:00`);
      if (logDate < fromDate) return false;
    }
    if (historyFilters.to) {
      const toDate = new Date(`${historyFilters.to}T23:59:59`);
      if (logDate > toDate) return false;
    }
    if (historyFilters.mood !== 'all' && String(log.mood) !== historyFilters.mood) return false;

    if (historyFilters.cause !== 'all' && !logCauses.includes(historyFilters.cause)) return false;

    if (historyFilters.media === 'any' && attachments.length === 0) return false;
    if (historyFilters.media === 'none' && attachments.length > 0) return false;
    if (['image', 'video', 'audio'].includes(historyFilters.media) && !attachments.some(item => item.kind === historyFilters.media)) {
      return false;
    }

    if (historyFilters.stressHigh && (metricValue(log.metrics, 'stress') ?? 0) < 4) return false;
    if (historyFilters.sleepLow && (metricValue(log.metrics, 'sleep') ?? 5) > 2) return false;
    return true;
  };

  const historyFilteredAllLogs = moodLogs.filter(matchesHistoryFilters);

  const filteredMoodLogs = (() => {
    if (historyRange === 'all') return historyFilteredAllLogs;
    const cutoff = subDays(new Date(), historyRange - 1);
    cutoff.setHours(0, 0, 0, 0);
    return historyFilteredAllLogs.filter(l => new Date(l.date) >= cutoff);
  })();

  // Chart: log mới nhất mỗi ngày
  const chartData = (() => {
    const sorted = [...filteredMoodLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const seen = new Set();
    const unique = [];
    sorted.forEach(l => {
      const key = new Date(l.date).toDateString();
      if (!seen.has(key)) { seen.add(key); unique.push(l); }
    });
    const chartLogs = historyRange === 'all' ? unique : unique.slice(0, historyRange);
    return chartLogs.reverse().map(l => ({
      date: format(new Date(l.date), 'dd/MM', { locale: vi }),
      score: allMoods.find(m => m.id === l.mood)?.score ?? 0,
      color: allMoods.find(m => m.id === l.mood)?.color || '#ccc',
    }));
  })();

  const monthHeatmap = (() => {
    const monthLogs = historyFilteredAllLogs
      .filter(log => {
        const d = new Date(log.date);
        return d.getMonth() === exportMonth && d.getFullYear() === exportYear;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const logsByDay = monthLogs.reduce((acc, log) => {
      const key = new Date(log.date).toDateString();
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});

    const first = new Date(exportYear, exportMonth, 1);
    const daysInMonth = new Date(exportYear, exportMonth + 1, 0).getDate();
    const blanks = Array.from({ length: first.getDay() }, (_, index) => index);
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(exportYear, exportMonth, index + 1);
      const key = date.toDateString();
      const logs = logsByDay[key] || [];
      const latest = logs[0];
      const mood = latest ? allMoods.find(m => m.id === latest.mood) : null;
      return { key, day: index + 1, logs, mood };
    });

    return { blanks, days };
  })();

  const grouped = groupByDay(filteredMoodLogs);
  const todaysLogs = moodLogs.filter(l => new Date(l.date).toDateString() === new Date().toDateString());
  const moodTabs = [
    { id: 'today', label: 'Ghi hôm nay', count: todaysLogs.length },
    { id: 'history', label: 'Lịch sử', count: moodLogs.length },
    { id: 'insight', label: 'Insight', count: (aiAdvice || aiLoading || aiError) ? 1 : 0 },
    { id: 'export', label: 'Xuất dữ liệu', count: 0 },
  ];

  return (
    <div className="mood-tracker">
      <div className="mood-page-header">
        <div>
          <h2>💭 Theo dõi cảm xúc</h2>
          <p className="text-muted">Ghi nhanh hôm nay, xem lại lịch sử, trò chuyện với AI và xuất nhật ký khi cần.</p>
        </div>
      </div>

      <div className="mood-tabs" role="tablist" aria-label="Các phần trong trang theo dõi cảm xúc">
        {moodTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`mood-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && <small>{tab.count}</small>}
          </button>
        ))}
      </div>

      <div className="tracker-layout tracker-tabbed-layout">
        {activeTab === 'today' && (
          <div className="tracker-form-col tracker-tab-panel">
            <div className="card checkin-card">
              <h3 className="mb-1">
                {editingId ? '✏️ Chỉnh sửa ghi chú' : '+ Ghi cảm xúc mới'}
              </h3>
              <p className="text-muted mb-4" style={{ fontSize: 13 }}>
                {format(new Date(), 'EEEE, dd/MM/yyyy – HH:mm', { locale: vi })}
              </p>

              <MoodSelector
                moods={MOODS}
                customMoods={customMoods}
                selected={selected}
                onSelect={setSelected}
                onOpenModal={() => setShowModal(true)}
                onDeleteCustomMood={handleDeleteCustomMood}
              />

              {selected && (
                <>
                  <CauseTagPicker
                    activeCauses={activeCauses}
                    causes={causes}
                    onToggleCause={toggleCause}
                    onUpdateCauses={setCauses}
                    saveCauseOptions={saveCauseOptions}
                  />
                  <MetricsPanel metrics={metrics} onUpdateMetric={updateMetric} />
                  <MoodNoteEditor
                    note={note}
                    onSetNote={setNote}
                    onTextareaChange={(value) => {
                      setNote(value);
                      if (detectDanger(value)) setShowSOS(true);
                    }}
                    noteTextareaRef={noteTextareaRef}
                    showNoteIcons={showNoteIcons}
                    onToggleNoteIcons={() => setShowNoteIcons(v => !v)}
                    excludeFromAI={excludeFromAI}
                    onExcludeFromAIChange={setExcludeFromAI}
                    media={media}
                    saving={saving}
                    editingId={editingId}
                    draftStatus={draftStatus}
                    hasDraftContent={hasDraftContent}
                    onClearDraft={clearDraft}
                  />
                  <button
                    className="btn btn-primary mt-4 w-full"
                    onClick={handleSave}
                    disabled={saving || media.recordingState !== 'idle'}
                  >
                    {saving
                      ? <span className="btn-loading">⏳ {saveStatus || 'Đang lưu...'}</span>
                      : editingId ? '💾 Cập nhật ghi chú' : '✨ Lưu cảm xúc'
                    }
                  </button>
                  {editingId && (
                    <button className="btn btn-secondary mt-2 w-full" onClick={resetForm}>
                      Hủy chỉnh sửa
                    </button>
                  )}
                </>
              )}
            </div>
            {checkinFeedback && (
              <div className="checkin-feedback" role="status">
                <span aria-hidden="true">✨</span>
                <span>{checkinFeedback}</span>
              </div>
            )}
            {showSOS && <CrisisPanel onDismiss={() => setShowSOS(false)} />}
          </div>
        )}

        {activeTab === 'insight' && (
          <MoodInsight
            aiLoading={aiLoading}
            aiError={aiError}
            lastAnalysisRequest={lastAnalysisRequest}
            onRetryAnalysis={runMoodAnalysis}
            aiPreview={aiPreview}
            aiPreviewStatus={aiPreviewStatus}
            onSavePreview={saveAnalysisPreview}
            onHidePreview={hideAnalysisPreview}
            onRegeneratePreview={regenerateAnalysisPreview}
            aiAdvice={aiAdvice}
            aiMemory={aiMemory}
            chatMessages={chatMessages}
            chatInput={chatInput}
            chatSending={chatSending}
            chatError={chatError}
            failedChatMessage={failedChatMessage}
            chatOpen={chatOpen}
            chatEndRef={chatEndRef}
            onResetChat={handleResetChat}
            onToggleChat={handleToggleChat}
            onChatInputChange={setChatInput}
            onSendChat={sendChat}
            onGoToToday={() => selectTab('today')}
          />
        )}

        {activeTab === 'history' && (
          <MoodHistory
            moodLogs={moodLogs}
            filteredMoodLogs={filteredMoodLogs}
            allMoods={allMoods}
            availableHistoryCauses={availableHistoryCauses}
            historyRange={historyRange}
            onChangeHistoryRange={setHistoryRange}
            historyFilters={historyFilters}
            hasAdvancedHistoryFilters={hasAdvancedHistoryFilters}
            onUpdateHistoryFilter={updateHistoryFilter}
            onResetHistoryFilters={resetHistoryFilters}
            exportMonth={exportMonth}
            exportYear={exportYear}
            isCurrentMonthSelected={isCurrentMonthSelected}
            isAtOrAfterCurrentMonth={isAtOrAfterCurrentMonth}
            monthHeatmap={monthHeatmap}
            onMoveCalendarMonth={moveCalendarMonth}
            onResetCalendarMonth={resetCalendarMonth}
            chartData={chartData}
            grouped={grouped}
            editingId={editingId}
            onSelectDayDetail={setSelectedDayDetail}
            onTogglePinned={toggleMoodLogPinned}
            onStartEdit={startEdit}
            onDelete={handleDelete}
            onOpenPhotoLightbox={openPhotoLightbox}
            onGoToExport={() => selectTab('export')}
          />
        )}

        {activeTab === 'export' && (
          <MoodExport
            exportOptions={exportOptions}
            setExportOptions={setExportOptions}
            exportMonth={exportMonth}
            setExportMonth={setExportMonth}
            exportYear={exportYear}
            setExportYear={setExportYear}
            exporting={exporting}
            moodLogsCount={moodLogs.length}
            onExportMonth={handleExport}
            onExportAll={handleExportAll}
          />
        )}
      </div>

      <DayDetailModal
        selectedDayDetail={selectedDayDetail}
        allMoods={allMoods}
        onClose={() => setSelectedDayDetail(null)}
        onOpenPhotoLightbox={openPhotoLightbox}
      />

      {/* Modal thêm custom mood */}
      {showModal && (
        <CustomMoodModal
          onClose={() => setShowModal(false)}
          onSave={addCustomMood}
        />
      )}

      <PhotoLightbox
        photoLightbox={photoLightbox}
        onClose={closePhotoLightbox}
        onMove={movePhotoLightbox}
      />
    </div>
  );
}
