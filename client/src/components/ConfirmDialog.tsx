interface Props {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDialog({ message, onCancel, onConfirm }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{message}</p>
        <div className="modal-actions">
          <button onClick={onCancel}>Abbrechen</button>
          <button
            className="danger"
            onClick={() => {
              onConfirm();
            }}
          >
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
