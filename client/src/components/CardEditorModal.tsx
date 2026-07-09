import { useState } from "react";
import type { Card } from "../types";

interface Props {
  initial?: Card;
  onCancel: () => void;
  onSave: (front: string, back: string, bidirectional: boolean) => Promise<void>;
}

export default function CardEditorModal({ initial, onCancel, onSave }: Props) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [bidirectional, setBidirectional] = useState(initial?.bidirectional ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!front.trim() || !back.trim()) {
      setError("Vorder- und Rückseite dürfen nicht leer sein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(front.trim(), back.trim(), bidirectional);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{initial ? "Karte bearbeiten" : "Neue Karte"}</h3>
        {error && <div className="error-banner">{error}</div>}
        <label>
          Vorderseite
          <textarea value={front} onChange={(e) => setFront(e.target.value)} autoFocus />
        </label>
        <label>
          Rückseite
          <textarea value={back} onChange={(e) => setBack(e.target.value)} />
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={bidirectional}
            onChange={(e) => setBidirectional(e.target.checked)}
          />
          Bidirektional (in beide Richtungen abfragen)
        </label>
        <div className="modal-actions">
          <button onClick={onCancel} disabled={saving}>
            Abbrechen
          </button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
