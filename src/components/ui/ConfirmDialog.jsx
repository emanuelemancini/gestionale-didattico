// src/components/ui/ConfirmDialog.jsx
import Modal from './Modal';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal
      title={title || 'Conferma'}
      onClose={onCancel}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancel}>Annulla</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            Conferma
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
