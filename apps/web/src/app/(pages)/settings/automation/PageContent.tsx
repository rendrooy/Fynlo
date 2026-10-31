"use client";

import type { IngestEventInterface, IngestTokenInterface } from "@fynlo/types";

import { Badge } from "@fynlo/ui/components/badge";
import { Button } from "@fynlo/ui/components/button";
import { Modal } from "@fynlo/ui/components/modal";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { useFinance } from "@/providers/finance-provider";
import { useTransactionSheet } from "@/providers/transaction-sheet-provider";
import {
  ApiError,
  createIngestTokenRequest,
  listIngestEventsRequest,
  listIngestTokensRequest,
  retryIngestEventRequest,
  revokeIngestTokenRequest,
} from "@/services/api";

const STATUS: Record<
  IngestEventInterface["status"],
  { label: string; tone: "danger" | "neutral" | "success" | "warning" }
> = {
  ambiguous: { label: "Check duplicate", tone: "warning" },
  created: { label: "Recorded", tone: "success" },
  failed: { label: "Couldn't read", tone: "danger" },
  ignored: { label: "Ignored", tone: "neutral" },
  merged: { label: "Matched", tone: "success" },
  unmatched: { label: "No account", tone: "warning" },
};

const errorText = (error: unknown) =>
  error instanceof ApiError ? error.message : "Please try again.";

const formatTime = (iso: null | string) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
      })
    : "Never";

export default function PageContent() {
  const { loadTransactions } = useFinance();
  const { toast } = useTransactionSheet();
  const [tokens, setTokens] = useState<IngestTokenInterface[]>([]);
  const [events, setEvents] = useState<IngestEventInterface[]>([]);
  const [status, setStatus] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [newToken, setNewToken] = useState("");
  const [revoking, setRevoking] = useState<IngestTokenInterface | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const [loadedTokens, loadedEvents] = await Promise.all([
        listIngestTokensRequest(),
        listIngestEventsRequest(),
      ]);
      setTokens(loadedTokens);
      setEvents(loadedEvents);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Enter a name");
      return;
    }
    setFormError("");
    try {
      const created = await createIngestTokenRequest(name.trim());
      setTokens((current) => [...current, created]);
      setNewToken(created.token);
      setIsAdding(false);
      setName("");
    } catch (error) {
      setFormError(errorText(error));
    }
  }

  async function revoke() {
    if (!revoking) return;
    try {
      await revokeIngestTokenRequest(revoking.id);
      setTokens((current) => current.filter((t) => t.id !== revoking.id));
      toast("Token revoked");
    } catch (error) {
      toast(errorText(error), true);
    }
    setRevoking(null);
  }

  async function retry(id: string) {
    try {
      const { status: next } = await retryIngestEventRequest(id);
      setEvents((current) =>
        current.map((e) => (e.id === id ? { ...e, status: next } : e)),
      );
      await Promise.all([load(), loadTransactions()]);
      toast(STATUS[next].label);
    } catch (error) {
      toast(errorText(error), true);
    }
  }

  return (
    <div className="page settings-page">
      <Link className="btn ghost back-link" href="/settings">
        <ArrowLeft aria-hidden="true" size={15} />
        Settings
      </Link>
      <div className="page-intro">
        <div>
          <h1>Automation</h1>
          <p>Record transactions automatically from bank emails.</p>
        </div>
      </div>

      {status === "error" && (
        <div className="card empty">
          <b>Couldn&apos;t load automation</b>
          <span>Check your connection and try again.</span>
          <Button kind="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}
      {status === "loading" && (
        <div className="card empty">
          <span>Loading...</span>
        </div>
      )}

      {status === "ready" && (
        <>
          <div className="section-heading">
            <div>
              <h2>Device tokens</h2>
              <p>Each token can only send messages, not read your data.</p>
            </div>
            <Button kind="secondary" onClick={() => setIsAdding(true)}>
              <Plus aria-hidden="true" size={17} />
              New Token
            </Button>
          </div>
          <div className="card manage-list">
            {tokens.length === 0 && (
              <div className="empty">
                <span>No tokens yet.</span>
              </div>
            )}
            {tokens.map((token) => (
              <div className="manage-row" key={token.id}>
                <div className="manage-copy">
                  <b>{token.name}</b>
                  <span>Last used: {formatTime(token.lastUsedTime)}</span>
                </div>
                <div className="account-actions">
                  <Button kind="ghost" onClick={() => setRevoking(token)}>
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="section-heading">
            <div>
              <h2>Recent messages</h2>
              <p>The last 100 messages received from your devices.</p>
            </div>
          </div>
          <div className="card manage-list">
            {events.length === 0 && (
              <div className="empty">
                <span>No messages yet.</span>
              </div>
            )}
            {events.map((event) => (
              <div className="manage-row" key={event.id}>
                <div className="manage-copy">
                  <b>{event.subject || event.sender || "Message"}</b>
                  <span>
                    {formatTime(event.receivedAt)}
                    {event.reason && ` · ${event.reason}`}
                  </span>
                </div>
                <Badge tone={STATUS[event.status].tone}>
                  {STATUS[event.status].label}
                </Badge>
                {(event.status === "failed" ||
                  event.status === "unmatched") && (
                  <div className="account-actions">
                    <Button kind="ghost" onClick={() => void retry(event.id)}>
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        onClose={() => setIsAdding(false)}
        open={isAdding}
        title="New Token"
      >
        <form noValidate onSubmit={add}>
          <label>
            Device name
            <input
              autoFocus
              maxLength={50}
              onChange={(event) => setName(event.target.value)}
              placeholder="Example: Gmail script"
              value={name}
            />
          </label>
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <div className="modal-actions">
            <Button kind="secondary" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Token</Button>
          </div>
        </form>
      </Modal>

      <Modal
        onClose={() => setNewToken("")}
        open={newToken !== ""}
        title="Copy your token"
      >
        <p className="modal-text">
          This is the only time the token is shown. Keep it private.
        </p>
        <input aria-label="New token" readOnly value={newToken} />
        <div className="modal-actions">
          <Button
            kind="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(newToken);
              toast("Token copied");
            }}
          >
            Copy
          </Button>
          <Button onClick={() => setNewToken("")}>Done</Button>
        </div>
      </Modal>

      <Modal
        onClose={() => setRevoking(null)}
        open={revoking !== null}
        title="Revoke token?"
      >
        <p className="modal-text">
          <b>{revoking?.name}</b> will stop being able to send messages.
        </p>
        <div className="modal-actions">
          <Button kind="secondary" onClick={() => setRevoking(null)}>
            Cancel
          </Button>
          <Button kind="danger" onClick={() => void revoke()}>
            Revoke Token
          </Button>
        </div>
      </Modal>
    </div>
  );
}
