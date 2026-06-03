import React, { useState, type KeyboardEvent } from 'react';
import { X, Plus, Hash } from 'lucide-react';
import type { KeywordInputProps } from '../interfaces';

export const KeywordInput: React.FC<KeywordInputProps> = ({ tags, onChange, placeholder = "Add keyword..." }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim().toLowerCase())) {
        onChange([...tags, input.trim().toLowerCase()]);
      }
      setInput('');
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Hash size={12} className="text-blue-500" /> Mandatory Keywords
        </label>
        <span className="text-[10px] text-slate-400 font-medium italic">Press Enter to add</span>
      </div>
      
      <div className="flex flex-wrap gap-2 p-3 bg-slate-50/50 border border-slate-200 rounded-lg focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/5 transition-all glass-input">
        {tags.map((tag, index) => (
          <span 
            key={index} 
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 shadow-sm animate-in fade-in zoom-in-95"
          >
            {tag}
            <button 
              onClick={() => removeTag(index)}
              className="text-slate-400 hover:text-rose-500 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-slate-700 placeholder:text-slate-400 min-w-[80px]"
        />
        {input.trim() && (
            <Plus size={14} className="text-blue-400 animate-pulse" />
        )}
      </div>
    </div>
  );
};
