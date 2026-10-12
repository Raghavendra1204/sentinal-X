import React, { useEffect, useState } from "react";
import { MessageSquare, Send, RefreshCw, User, Clock } from "lucide-react";
import { api } from "../api/jobs";
import type { JobComment } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function JobComments({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<JobComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadComments = async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const data = await api.comments(jobId);
      setComments(data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadComments();
  }, [jobId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting || !user) return;
    setSubmitting(true);
    setError("");
    try {
      const added = await api.addComment(jobId, {
        author_id: user.id,
        author_name: user.name,
        author_role: user.role,
        comment_text: newComment.trim(),
      });
      setComments((prev) => [...prev, added]);
      setNewComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="eyebrow">OPERATOR COLLABORATION</div>
          <h3 style={{ margin: "4px 0 0", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={16} className="text-cyan" />
            Audit Comments & Field Notes ({comments.length})
          </h3>
        </div>
        <button
          className="icon-button"
          onClick={() => void loadComments()}
          disabled={loading}
          title="Refresh comments thread"
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading && !comments.length ? (
          <div className="loading-state" style={{ padding: "16px 0", fontSize: "0.85rem" }}>
            <RefreshCw size={14} className="spin" /> Loading comments...
          </div>
        ) : !comments.length ? (
          <div className="empty-state" style={{ padding: "20px 0", fontSize: "0.85rem" }}>
            No comments yet. Leave a note or audit justification below.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {comments.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "rgba(15, 23, 42, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "rgba(56, 189, 248, 0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        color: "var(--cyan-primary)",
                      }}
                    >
                      <User size={12} />
                    </div>
                    <strong style={{ fontSize: "0.82rem" }}>{c.author_name}</strong>
                    <span style={{ fontSize: "0.7rem", opacity: 0.65 }}>({c.author_role})</span>
                    <code style={{ fontSize: "0.68rem", background: "rgba(255, 255, 255, 0.05)", padding: "1px 4px", borderRadius: 4 }}>
                      {c.author_id}
                    </code>
                  </div>
                  <span style={{ fontSize: "0.7rem", opacity: 0.5, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} />
                    {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", lineHeight: 1.4, color: "var(--text-light, #e2e8f0)", whiteSpace: "pre-wrap" }}>
                  {c.comment_text}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={`Add a note as ${user?.name || "Operator"}...`}
            disabled={submitting}
            style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
          />
          <button
            type="submit"
            className="button button-primary"
            disabled={!newComment.trim() || submitting}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {submitting ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
            <span>Comment</span>
          </button>
        </form>
      </div>
    </div>
  );
}
