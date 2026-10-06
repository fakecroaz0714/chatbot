import React from 'react';

const StatusBadge = ({ isOnline, className = '' }) => {
  return (
    <span
      className={`status-badge ${isOnline ? 'online' : 'offline'} ${className}`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
};

export default StatusBadge;
