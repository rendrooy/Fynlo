"use client";

import type { TransactionInterface, TransactionType } from "@fynlo/types";

import { Modal } from "@fynlo/ui/components/modal";
import { Check, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TransactionDrawer } from "@/components/TransactionDrawer";
import { TransactionForm } from "@/components/TransactionForm";

type FormState = { editing: TransactionInterface } | { type: TransactionType };

interface TransactionSheetValue {
  openDetails: (transaction: TransactionInterface) => void;
  openSheet: (type?: TransactionType) => void;
  toast: (message: string) => void;
}

const TransactionSheetContext = createContext<null | TransactionSheetValue>(
  null,
);

export function TransactionSheetProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [selectedId, setSelectedId] = useState<null | string>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 2600);
    return () => clearTimeout(timer);
  }, [message]);

  const value = useMemo(
    () => ({
      openDetails: (transaction: TransactionInterface) =>
        setSelectedId(transaction.id),
      openSheet: (type: TransactionType = "expense") => setForm({ type }),
      toast: setMessage,
    }),
    [],
  );

  const editing = form && "editing" in form ? form.editing : undefined;

  return (
    <TransactionSheetContext.Provider value={value}>
      {children}

      <TransactionDrawer
        id={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(transaction) => {
          setSelectedId(null);
          setForm({ editing: transaction });
        }}
        toast={setMessage}
      />

      <Modal
        onClose={() => setForm(null)}
        open={form !== null}
        title={editing ? "Edit Transaction" : "Add Transaction"}
      >
        {form && (
          <TransactionForm
            defaultType={"type" in form ? form.type : undefined}
            editing={editing}
            onCancel={() => setForm(null)}
            onSaved={(text) => {
              setForm(null);
              setMessage(text);
            }}
          />
        )}
      </Modal>

      {message && (
        <div aria-live="polite" className="toast" role="status">
          <Check aria-hidden="true" size={20} />
          <div>
            <b>Done</b>
            <span>{message}</span>
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => setMessage("")}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}
    </TransactionSheetContext.Provider>
  );
}

export function useTransactionSheet() {
  const value = useContext(TransactionSheetContext);
  if (!value)
    throw new Error(
      "useTransactionSheet must be used inside TransactionSheetProvider",
    );
  return value;
}
