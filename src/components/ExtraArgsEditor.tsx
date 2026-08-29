import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface ExtraArgsEditorProps {
  args: string[];
  onChange: (args: string[]) => void;
  label?: string;
  placeholder?: string;
  helpText?: string;
}

export const ExtraArgsEditor: React.FC<ExtraArgsEditorProps> = ({
  args,
  onChange,
  label = '高级参数 (每行一个完整参数)',
  placeholder = '例如: --no-mtime 或 --write-thumbnail',
  helpText = '参数将作为独立的命令行参数数组传递，无需手动转义空格或使用引号。',
}) => {
  const handleAdd = () => {
    onChange([...args, '']);
  };

  const handleUpdate = (index: number, value: string) => {
    const updated = [...args];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    const updated = args.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-300">{label}</label>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2.5 py-1 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加参数
        </button>
      </div>

      {helpText && <p className="text-xs text-zinc-400">{helpText}</p>}

      {args.length === 0 ? (
        <div className="py-2.5 px-3 bg-zinc-950/60 rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-400 text-center">
          暂无自定义附加参数，点击上方“添加参数”增加
        </div>
      ) : (
        <div className="space-y-2">
          {args.map((arg, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={arg}
                onChange={(e) => handleUpdate(index, e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-3 py-1.5 text-sm bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 font-mono text-zinc-100 placeholder-zinc-400"
              />
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/40 rounded-md transition-colors"
                title="删除此参数"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
