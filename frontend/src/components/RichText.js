import React from 'react';
import './RichText.css';

function parseInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|<u>[\s\S]*?<\/u>)/gi;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={`b-${match.index}`}>{parseInline(token.slice(2, -2))}</strong>);
    } else if (/^<u>/i.test(token)) {
      parts.push(<u key={`u-${match.index}`}>{parseInline(token.replace(/^<u>/i, '').replace(/<\/u>$/i, ''))}</u>);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : text;
}

export default function RichText({ text, fallback = '', className = '' }) {
  const source = String(text || '').trim();
  if (!source) {
    return fallback ? <p className={`rich-text ${className}`.trim()}>{fallback}</p> : null;
  }

  const lines = source.split(/\r?\n/);
  const blocks = [];
  let checklist = [];

  const flushChecklist = () => {
    if (!checklist.length) return;
    blocks.push(
      <ul key={`checklist-${blocks.length}`} className="rich-checklist">
        {checklist.map((item, index) => (
          <li key={`${item.text}-${index}`} className={item.checked ? 'checked' : ''}>
            <span aria-hidden="true">{item.checked ? '✓' : ''}</span>
            <p>{parseInline(item.text)}</p>
          </li>
        ))}
      </ul>
    );
    checklist = [];
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const checklistMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      checklist.push({
        checked: checklistMatch[1].toLowerCase() === 'x',
        text: checklistMatch[2],
      });
      return;
    }

    flushChecklist();
    if (!trimmed) {
      blocks.push(<div key={`space-${index}`} className="rich-space" />);
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const Tag = headingMatch[1].length === 1 ? 'h3' : headingMatch[1].length === 2 ? 'h4' : 'h5';
      blocks.push(<Tag key={`heading-${index}`} className="rich-heading">{parseInline(headingMatch[2])}</Tag>);
      return;
    }

    const quoteMatch = trimmed.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      blocks.push(<blockquote key={`quote-${index}`}>{parseInline(quoteMatch[1])}</blockquote>);
      return;
    }

    blocks.push(<p key={`p-${index}`}>{parseInline(line)}</p>);
  });

  flushChecklist();

  return <div className={`rich-text ${className}`.trim()}>{blocks}</div>;
}
