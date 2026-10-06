import React from 'react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

const CallAlertToast = () => {
  const alert = useCallStore((s) => s.alert);
  const clearAlert = useCallStore((s) => s.clearAlert);

  if (!alert) return null;

  const isError = alert.type === 'error';
  const isWarning = alert.type === 'warning';

  return (
    <div className={`call-toast-container ${alert.type}`}>
      <div className="call-toast-icon">
        {isError && <AlertCircle size={18} color="#ef4444" />}
        {isWarning && <AlertCircle size={18} color="#f59e0b" />}
        {!isError && !isWarning && <Info size={18} color="var(--accent-primary)" />}
      </div>
      <div className="call-toast-message">{alert.message}</div>
      <button type="button" onClick={clearAlert} className="call-toast-close" title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
};

export default CallAlertToast;
