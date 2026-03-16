import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const STATUS_FLOW = ["open", "in-progress", "resolved"];
const STATUS_LABELS = {
  open: "Open",
  "in-progress": "In Progress",
  resolved: "Resolved",
};
const SENTIMENT_LABELS = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

function getNextStatus(currentStatus) {
  const currentIndex = STATUS_FLOW.indexOf(currentStatus);
  const safeIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (safeIndex + 1) % STATUS_FLOW.length;
  return STATUS_FLOW[nextIndex];
}

async function readApiError(response, fallbackMessage) {
  try {
    const payload = await response.json();
    if (payload?.error && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function App() {
  const [feedbackText, setFeedbackText] = useState("");
  const [items, setItems] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [deletingIds, setDeletingIds] = useState(new Set());

  async function loadFeedback() {
    setListError("");

    try {
      const response = await fetch(`${API_BASE_URL}/feedback`);

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Gagal mengambil data feedback.",
        );
        throw new Error(message);
      }

      const payload = await response.json();
      const list = Array.isArray(payload) ? [...payload].reverse() : [];
      setItems(list);
    } catch (error) {
      setListError(
        error.message || "Terjadi kesalahan saat mengambil feedback.",
      );
    } finally {
      setIsLoadingList(false);
    }
  }

  useEffect(() => {
    void loadFeedback();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = feedbackText.trim();

    if (!text) {
      setActionError("Feedback tidak boleh kosong.");
      return;
    }

    setActionError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Gagal menambahkan feedback.",
        );
        throw new Error(message);
      }

      const createdItem = await response.json();
      setItems((previous) => [createdItem, ...previous]);
      setFeedbackText("");
    } catch (error) {
      setActionError(
        error.message || "Terjadi kesalahan saat menyimpan feedback.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusToggle(item) {
    const nextStatus = getNextStatus(item.status);

    setActionError("");
    setUpdatingIds((previous) => {
      const next = new Set(previous);
      next.add(item.id);
      return next;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Gagal mengubah status feedback.",
        );
        throw new Error(message);
      }

      const updatedItem = await response.json();
      setItems((previous) =>
        previous.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem,
        ),
      );
    } catch (error) {
      setActionError(
        error.message || "Terjadi kesalahan saat mengubah status.",
      );
    } finally {
      setUpdatingIds((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
    }
  }

  async function handleDelete(item) {
    setActionError("");
    setDeletingIds((previous) => {
      const next = new Set(previous);
      next.add(item.id);
      return next;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/feedback/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const message = await readApiError(
          response,
          "Gagal menghapus feedback.",
        );
        throw new Error(message);
      }

      setItems((previous) =>
        previous.filter((currentItem) => currentItem.id !== item.id),
      );
    } catch (error) {
      setActionError(error.message || "Terjadi kesalahan saat menghapus data.");
    } finally {
      setDeletingIds((previous) => {
        const next = new Set(previous);
        next.delete(item.id);
        return next;
      });
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient-glow ambient-glow-left" aria-hidden="true"></div>
      <div className="ambient-glow ambient-glow-right" aria-hidden="true"></div>

      <main className="app-layout">
        <header className="hero-header">
          <p className="eyebrow">Feedback Intelligence Dashboard</p>
          <h1>Kelola Feedback Dengan Insight AI</h1>
          <p className="subtitle">
            Input feedback user, pantau sentiment dan kategori otomatis, lalu
            update status proses dengan sekali klik.
          </p>
        </header>

        <section className="panel">
          <h2 className="panel-title">Submit Feedback Baru</h2>
          <form className="feedback-form" onSubmit={handleSubmit}>
            <label htmlFor="feedback-input">Isi feedback</label>
            <textarea
              id="feedback-input"
              className="feedback-input"
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Contoh: Proses checkout di mobile sering lambat saat memilih pembayaran."
              rows={4}
              disabled={isSubmitting}
            />

            <div className="form-actions">
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "AI sedang menganalisis..." : "Kirim Feedback"}
              </button>

              {isSubmitting ? (
                <p className="loading-note" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden="true"></span>
                  Memproses sentiment, category, dan action summary...
                </p>
              ) : null}
            </div>
          </form>

          {actionError ? (
            <p className="error-banner" role="alert">
              {actionError}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <div className="list-heading">
            <h2 className="panel-title">Daftar Feedback</h2>
            <span className="item-count">{items.length} item</span>
          </div>

          {isLoadingList ? (
            <div className="list-loader" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true"></span>
              Memuat data feedback...
            </div>
          ) : null}

          {!isLoadingList && listError ? (
            <div className="list-error" role="alert">
              <p>{listError}</p>
              <button
                type="button"
                className="retry-button"
                onClick={() => void loadFeedback()}
              >
                Coba Lagi
              </button>
            </div>
          ) : null}

          {!isLoadingList && !listError && items.length === 0 ? (
            <div className="empty-state">
              Belum ada feedback. Kirim feedback pertama lewat form di atas.
            </div>
          ) : null}

          {!isLoadingList && !listError && items.length > 0 ? (
            <ul className="feedback-list">
              {items.map((item) => {
                const nextStatus = getNextStatus(item.status);
                const isUpdating = updatingIds.has(item.id);
                const isDeleting = deletingIds.has(item.id);
                const isBusy = isUpdating || isDeleting;

                return (
                  <li
                    className={`feedback-card status-${item.status || "open"}`}
                    key={item.id}
                  >
                    <p className="feedback-text">{item.text}</p>

                    <div className="chips">
                      <span
                        className={`chip chip-status status-pill-${item.status || "open"}`}
                      >
                        Status:{" "}
                        {STATUS_LABELS[item.status] || STATUS_LABELS.open}
                      </span>
                      <span
                        className={`chip chip-sentiment sentiment-${item.sentiment || "neutral"}`}
                      >
                        Sentiment:{" "}
                        {SENTIMENT_LABELS[item.sentiment] ||
                          SENTIMENT_LABELS.neutral}
                      </span>
                      <span className="chip chip-category">
                        Category: {item.category || "Other"}
                      </span>
                    </div>

                    <p className="action-summary">
                      {item.action_summary || "-"}
                    </p>

                    <div className="card-actions">
                      <button
                        type="button"
                        className="status-button"
                        onClick={() => void handleStatusToggle(item)}
                        disabled={isBusy}
                      >
                        {isUpdating
                          ? "Mengubah status..."
                          : `Ubah ke ${STATUS_LABELS[nextStatus]}`}
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => void handleDelete(item)}
                        disabled={isBusy}
                      >
                        {isDeleting ? "Menghapus..." : "Hapus"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
