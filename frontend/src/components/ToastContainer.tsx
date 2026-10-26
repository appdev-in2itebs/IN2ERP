import React from 'react';
import { useNotification } from '@/stores/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  const renderIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={20} color="#10b981" />;
      case 'error':
        return <AlertCircle size={20} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={20} color="#f59e0b" />;
      default:
        return <Info size={20} color="#3b82f6" />;
    }
  };

  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <div key={n.id} className={`toast toast-${n.type}`}>
          {renderIcon(n.type)}
          <div style={{ flex: 1 }}>
            {n.title && <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{n.title}</div>}
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>{n.message}</div>
          </div>
          <button
            onClick={() => removeNotification(n.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
