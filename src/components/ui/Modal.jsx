// src/components/ui/Modal.jsx
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size ? 'modal-' + size : ''}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" style={{display:'flex', alignItems:'center', justifyContent:'center'}} onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
