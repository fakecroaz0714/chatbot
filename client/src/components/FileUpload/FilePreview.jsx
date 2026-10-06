import React from 'react';
import { X, File, Image, Film, Music } from 'lucide-react';

const FilePreview = ({ file, onRemove }) => {
  if (!file) return null;

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getIcon = () => {
    if (file.type.startsWith('image/')) return <Image size={18} />;
    if (file.type.startsWith('video/')) return <Film size={18} />;
    if (file.type.startsWith('audio/')) return <Music size={18} />;
    return <File size={18} />;
  };

  return (
    <div className="file-preview-bar">
      <div className="file-preview-info">
        {getIcon()}
        <span>{file.name}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          ({formatFileSize(file.size)})
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="icon-btn"
        style={{ width: '28px', height: '28px' }}
        title="Remove attachment"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default FilePreview;
