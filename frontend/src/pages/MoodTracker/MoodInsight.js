import React from 'react';

export default function MoodInsight({
  aiLoading,
  aiError,
  lastAnalysisRequest,
  onRetryAnalysis,
  aiPreview,
  aiPreviewStatus,
  onSavePreview,
  onHidePreview,
  onRegeneratePreview,
  aiAdvice,
  aiMemory,
  chatMessages,
  chatInput,
  chatSending,
  chatError,
  failedChatMessage,
  chatOpen,
  chatEndRef,
  onResetChat,
  onToggleChat,
  onChatInputChange,
  onSendChat,
  onGoToToday,
}) {
  return (
    <div className="tracker-tab-panel insight-tab-panel">
      {/* AI Advice & Chat */}
      {(aiLoading || aiPreview || aiAdvice || aiError || aiPreviewStatus) ? (
        <div className="card mt-4">
          {aiLoading && (
            <div className="ai-loading ai-status">
              <span className="ai-status-title">AI đang phân tích cảm xúc của bạn</span>
              <span className="ai-status-detail">Thường mất vài chục giây. Bạn có thể tiếp tục xem nhật ký trong lúc chờ.</span>
            </div>
          )}
          {aiError && !aiLoading && (
            <div className="ai-error">
              <div>
                <strong>Chưa lấy được lời khuyên AI</strong>
                <p>{aiError}</p>
              </div>
              {lastAnalysisRequest && (
                <button className="btn btn-secondary" onClick={() => onRetryAnalysis(lastAnalysisRequest)}>
                  Thử lại
                </button>
              )}
            </div>
          )}
          {aiPreview && !aiLoading && (
            <div className="ai-advice ai-preview-card">
              <div className="ai-advice-header">
                <span>✨ Bản phân tích nháp</span>
                <span className="memory-badge">Chưa lưu</span>
              </div>
              <p>{aiPreview.advice}</p>
              {aiPreviewStatus && <p className="ai-preview-note">{aiPreviewStatus}</p>}
              <div className="ai-preview-actions">
                <button className="btn btn-primary" onClick={onSavePreview}>
                  Lưu phân tích này
                </button>
                <button className="btn btn-secondary" onClick={onHidePreview}>
                  Ẩn khỏi lịch sử
                </button>
                <button className="btn btn-secondary" onClick={onRegeneratePreview} disabled={aiLoading}>
                  Tạo lại
                </button>
              </div>
            </div>
          )}
          {!aiPreview && aiPreviewStatus && !aiLoading && (
            <p className="ai-preview-saved-status">{aiPreviewStatus}</p>
          )}
          {aiAdvice && !aiLoading && !aiPreview && (
            <>
              <div className="ai-advice">
                <div className="ai-advice-header">
                  <span>✨ Lời khuyên từ AI</span>
                  {aiMemory && aiMemory.length > 0 && (
                    <span className="memory-badge" title={`AI nhớ ${aiMemory.length} ngày gần đây`}>
                      🧠 Nhớ {aiMemory.length} ngày
                    </span>
                  )}
                </div>
                <p>{aiAdvice}</p>
              </div>
              <div className="ai-chat mt-3">
                <div className="ai-chat-header">
                  <span>💬 Trò chuyện với MindBuddy AI</span>
                  <div className="chat-header-actions">
                    {chatMessages.length > 0 && (
                      <button className="chat-action-btn" onClick={onResetChat}>🔄 Mới</button>
                    )}
                    <button className="chat-action-btn" onClick={onToggleChat}>
                      {chatOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>
                {chatOpen && (
                  <>
                    <div className="chat-messages">
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`chat-bubble ${m.role}`}>
                          <span className="chat-avatar">{m.role === 'ai' ? '🤖' : '👤'}</span>
                          <span className="chat-text">{m.text}</span>
                        </div>
                      ))}
                      {chatSending && (
                        <div className="chat-bubble ai">
                          <span className="chat-avatar">🤖</span>
                          <span className="chat-text typing">Đang trả lời, vui lòng đợi trong giây lát...</span>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {chatError && (
                      <div className="chat-error">
                        <span>{chatError}</span>
                        {failedChatMessage && (
                          <button className="chat-retry-btn" onClick={() => onSendChat(failedChatMessage)}>
                            Thử lại
                          </button>
                        )}
                      </div>
                    )}
                    <div className="chat-input-row">
                      <input
                        value={chatInput}
                        onChange={e => onChatInputChange(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onSendChat()}
                        placeholder="Nhắn tin với AI..."
                        disabled={chatSending}
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => onSendChat()}
                        disabled={chatSending || !chatInput.trim()}
                      >
                        Gửi
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="card insight-empty-card">
          <div className="empty-timeline">
            <div style={{ fontSize: 40 }} aria-hidden="true">✨</div>
            <h3>Chưa có insight hôm nay</h3>
            <p className="text-muted">Ghi một cảm xúc mới để MindBuddy phân tích và gợi ý bước tiếp theo.</p>
            <button className="btn btn-primary mt-2" onClick={onGoToToday}>
              Ghi cảm xúc ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
