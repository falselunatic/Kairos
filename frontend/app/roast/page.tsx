"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { BrandName } from "@/components/BrandName";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { extractErrorDetail, friendlyFetchError } from "@/lib/errors";
import { blurActiveElement } from "@/lib/dom";
import styles from "./roast.module.css";

type Round = {
  round: number;
  kairosLine: string;
  userLine?: string;
  kairosScore?: number;
  userScore?: number;
};

type Winner = "user" | "kairos" | "tie" | null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOTAL_ROUNDS = 5;

export default function RoastBattlePage() {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [battleId, setBattleId] = useState<number | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [kairosTotal, setKairosTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState<Winner>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !session) {
      router.push("/login");
    }
  }, [authLoading, session, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rounds, loading]);

  async function startBattle() {
    if (!session) return;
    setStarting(true);
    setError("");
    setRounds([]);
    setUserTotal(0);
    setKairosTotal(0);
    setFinished(false);
    setWinner(null);
    try {
      const res = await fetch(`${API_URL}/roast/start`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();
      setBattleId(data.battle_id);
      setRounds([{ round: data.round, kairosLine: data.kairos_line }]);
    } catch (err) {
      // leave start screen up so the user can retry
      setError(friendlyFetchError(err, "Could not start a battle."));
    } finally {
      setStarting(false);
    }
  }

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    blurActiveElement();
    const text = input.trim();
    if (!text || loading || !session || battleId === null) return;

    setLoading(true);
    setError("");
    setInput("");

    try {
      const res = await fetch(`${API_URL}/roast/${battleId}/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) throw new Error(await extractErrorDetail(res));
      const data = await res.json();

      setRounds((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = {
          ...last,
          userLine: data.user_line,
          kairosScore: data.kairos_score,
          userScore: data.user_score,
        };
        if (!data.finished && data.next_kairos_line) {
          updated.push({ round: data.round + 1, kairosLine: data.next_kairos_line });
        }
        return updated;
      });
      setUserTotal(data.user_total);
      setKairosTotal(data.kairos_total);
      if (data.finished) {
        setFinished(true);
        setWinner(data.winner);
      }
    } catch (err) {
      // restore what they typed so they don't lose it, and let them retry
      setInput(text);
      setError(friendlyFetchError(err, "Could not send that line."));
    } finally {
      setLoading(false);
    }
  }

  function resetBattle() {
    setBattleId(null);
    setRounds([]);
    setUserTotal(0);
    setKairosTotal(0);
    setFinished(false);
    setWinner(null);
  }

  if (authLoading || !session) {
    return null;
  }

  const currentRound = rounds.length;

  return (
    <div className={styles.page}>
      <Sidebar />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Roast Battle</div>
            <div className={styles.subtitle}>
              Trade jabs with <BrandName />, funniest lines win.
            </div>
          </div>
          {battleId !== null && !finished && (
            <button className={styles.clearButton} onClick={() => setConfirmingReset(true)}>
              Reset battle
            </button>
          )}
        </div>

        <ConfirmDialog
          open={confirmingReset}
          message="Abandon this battle and go back to start?"
          confirmLabel="Abandon it"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            setConfirmingReset(false);
            resetBattle();
          }}
        />

        <div className={styles.panel}>
          {battleId === null ? (
            <div className={styles.startScreen}>
              <div className={styles.title}>Ready to battle?</div>
              <p>
                Best of {TOTAL_ROUNDS} rounds. Kairos throws a roast using what it knows about
                you, you throw one back, and a judge scores who was funnier each round.
              </p>
              <button className={styles.button} onClick={startBattle} disabled={starting}>
                {starting ? "Warming up..." : "Start Roast Battle"}
              </button>
              {error && <div className={styles.errorText}>{error}</div>}
            </div>
          ) : (
            <>
              <div className={styles.scoreboard}>
                <div className={styles.scoreSide}>
                  <div className={styles.scoreLabel}>Kairos</div>
                  <div className={styles.scoreValue}>{kairosTotal}</div>
                </div>
                <div>
                  <div className={styles.vs}>VS</div>
                  <div className={styles.roundPill}>
                    Round {Math.min(currentRound, TOTAL_ROUNDS)}/{TOTAL_ROUNDS}
                  </div>
                </div>
                <div className={styles.scoreSide}>
                  <div className={styles.scoreLabel}>You</div>
                  <div className={styles.scoreValue}>{userTotal}</div>
                </div>
              </div>

              <div className={styles.log}>
                {rounds.map((r) => (
                  <div key={r.round} className={styles.roundBlock}>
                    <div className={styles.roundNumber}>Round {r.round}</div>

                    <div className={styles.lineRow}>
                      <div className={styles.avatar}>K</div>
                      <div className={`${styles.bubble} ${styles.kairosBubble}`}>
                        {r.kairosLine}
                      </div>
                    </div>
                    {r.kairosScore !== undefined && (
                      <div className={styles.scoreTag}>wit score: {r.kairosScore}/10</div>
                    )}

                    {r.userLine && (
                      <>
                        <div className={`${styles.lineRow} ${styles.lineRowUser}`}>
                          <div className={`${styles.bubble} ${styles.userBubble}`}>
                            {r.userLine}
                          </div>
                        </div>
                        <div className={`${styles.scoreTag} ${styles.scoreTagUser}`}>
                          wit score: {r.userScore}/10
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className={styles.roundBlock}>
                    <div className={styles.lineRow}>
                      <div className={styles.avatar}>K</div>
                      <div className={`${styles.bubble} ${styles.kairosBubble}`}>…</div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {finished ? (
                <div className={styles.winnerBanner}>
                  <div className={styles.winnerText}>
                    {winner === "user"
                      ? "You won this battle!"
                      : winner === "kairos"
                        ? "Kairos won this one."
                        : "It's a tie!"}
                  </div>
                  <button className={styles.button} onClick={startBattle} disabled={starting}>
                    Battle again
                  </button>
                </div>
              ) : (
                <form className={styles.form} onSubmit={submitReply}>
                  <input
                    className={styles.input}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Throw your comeback..."
                    autoFocus
                  />
                  <button className={styles.button} type="submit" disabled={loading}>
                    Throw
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
