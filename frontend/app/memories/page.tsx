"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { BrandName } from "@/components/BrandName";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import styles from "./memories.module.css";

type Memory = {
  id: number;
  content: string;
  created_at: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function MemoriesPage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_URL}/memories`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => setMemories(Array.isArray(data) ? data : []))
      .catch(() => setMemories([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  async function handleDelete(id: number) {
    if (!session) return;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    await fetch(`${API_URL}/memories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  }

  async function handleForgetAll() {
    if (!session || memories.length === 0) return;
    setClearing(true);
    setMemories([]);
    try {
      await fetch(`${API_URL}/memories`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } finally {
      setClearing(false);
    }
  }

  if (authLoading || !session) {
    return null;
  }

  return (
    <div className={styles.page}>
      <Sidebar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>
              What <BrandName showTooltip={false} /> remembers
            </div>
            <div className={styles.subtitle}>
              Everything Kairos has picked up about you so far. You're in control of it.
            </div>
          </div>
          {memories.length > 0 && (
            <button
              className={styles.forgetAllButton}
              onClick={() => setConfirmingForget(true)}
              disabled={clearing}
            >
              {clearing ? "Forgetting..." : "Forget all"}
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmingForget}
          message="Forget everything Kairos knows about you? This can't be undone."
          confirmLabel="Forget it all"
          onCancel={() => setConfirmingForget(false)}
          onConfirm={() => {
            setConfirmingForget(false);
            handleForgetAll();
          }}
        />

        <div className={styles.panel}>
          {loading ? (
            <div className={styles.empty}>Loading...</div>
          ) : memories.length === 0 ? (
            <div className={styles.empty}>
              Nothing remembered yet.
              <br />
              Go chat with Kairos and it'll start picking things up.
            </div>
          ) : (
            <div className={styles.list}>
              {memories.map((m) => (
                <div key={m.id} className={styles.item}>
                  <span className={styles.itemText}>{m.content}</span>
                  <button className={styles.deleteButton} onClick={() => handleDelete(m.id)}>
                    Forget
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
