import { useEffect, useState } from "react";
import { Users, Plus, Pencil, Trash2, Shield, X } from "lucide-react";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorBanner, Spinner } from "../../components/ui/Feedback";
import { useIdentity } from "../../state/identity";
import {
  createTrustedContact, deleteTrustedContact, listTrustedContacts, updateTrustedContact,
} from "../../api/client";
import type { ContactOut, ContactType } from "../../api/types";
import { describeError } from "../../lib/errors";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const RELATIONSHIPS = [
  "Son", "Daughter", "Mother", "Father", "Parent", "Spouse",
  "Brother", "Sister", "Sibling", "Grandparent", "Other trusted person",
];

const TIER_LABEL: Record<ContactType, string> = {
  PRIMARY: "Tier 1 · Trusted contact",
  SECONDARY: "Tier 2 · Escalation contact",
};

interface FormState {
  contact_id?: string;
  contact_name: string;
  relationship: string;
  phone_number: string;
  contact_type: ContactType;
}

const EMPTY_FORM: FormState = { contact_name: "", relationship: RELATIONSHIPS[0], phone_number: "", contact_type: "SECONDARY" };

export function Family() {
  useDocumentTitle("Family");
  const { identity } = useIdentity();
  const [contacts, setContacts] = useState<ContactOut[] | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    if (!identity) return;
    listTrustedContacts(identity.token, identity.id)
      .then(setContacts)
      .catch((e) => setError(describeError(e)));
  }

  useEffect(load, [identity]);

  if (!identity || identity.role !== "requester") {
    return <ErrorBanner title="No requester persona selected" message="Go to the home page and pick the requester persona." />;
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(c: ContactOut) {
    setForm({
      contact_id: c.contact_id,
      contact_name: c.contact_name,
      relationship: c.relationship ?? RELATIONSHIPS[0],
      phone_number: c.phone_number,
      contact_type: c.contact_type,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.contact_name.trim() || !form.phone_number.trim()) {
      setFormError("Name and phone number are required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (form.contact_id) {
        await updateTrustedContact(identity!.token, form.contact_id, {
          contact_name: form.contact_name.trim(),
          relationship: form.relationship,
          phone_number: form.phone_number.trim(),
          contact_type: form.contact_type,
        });
      } else {
        await createTrustedContact(identity!.token, {
          requester_id: identity!.id,
          contact_name: form.contact_name.trim(),
          relationship: form.relationship,
          phone_number: form.phone_number.trim(),
          contact_type: form.contact_type,
        });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(describeError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(contactId: string) {
    if (!window.confirm("Remove this trusted contact?")) return;
    try {
      await deleteTrustedContact(identity!.token, contactId);
      load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  async function setTier(c: ContactOut, tier: ContactType) {
    try {
      await updateTrustedContact(identity!.token, c.contact_id, { contact_type: tier });
      load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">My family</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Trusted contacts who independently verify risky requests for you.</p>
        </div>
        <Button onClick={openAdd} icon={<Plus className="h-4 w-4" />}>
          Add
        </Button>
      </div>

      {error && <ErrorBanner title={error.title} message={error.message} />}
      {!contacts && !error && <Spinner label="Loading trusted contacts…" />}

      {contacts && contacts.length === 0 && (
        <EmptyState
          icon={<Users className="mx-auto h-8 w-8" />}
          title="No trusted contacts yet"
          message="Add at least one trusted contact so SafeSignal has someone to verify with when a request looks risky."
          action={<Button onClick={openAdd}>Add trusted contact</Button>}
        />
      )}

      {contacts && contacts.length > 0 && (
        <div className="flex flex-col gap-3">
          {contacts.map((c) => (
            <Card key={c.contact_id}>
              <CardBody className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{c.contact_name}</p>
                    <span className="flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-success)]">
                      <Shield className="h-2.5 w-2.5" /> Protected
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{c.relationship ?? "Trusted contact"}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-cyan)]">{TIER_LABEL[c.contact_type]}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-faint)]">{c.phone_number}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
                      aria-label={`Edit ${c.contact_name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(c.contact_id)}
                      className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                      aria-label={`Remove ${c.contact_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTier(c, c.contact_type === "PRIMARY" ? "SECONDARY" : "PRIMARY")}
                    className="text-[11px] font-medium text-[var(--color-text-faint)] underline decoration-dotted hover:text-[var(--color-text)]"
                  >
                    Set as {c.contact_type === "PRIMARY" ? "Tier 2" : "Tier 1"}
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.contact_id ? "Edit trusted contact" : "Add trusted contact"}>
        <div className="flex flex-col gap-4">
          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Name</span>
            <input
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              placeholder="e.g. Priya Sharma"
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Relationship</span>
            <select
              value={form.relationship}
              onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]"
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1.5 block font-medium">Phone number</span>
            <input
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              placeholder="+91 98765 00000"
              className="w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-gold)]"
            />
          </label>

          <div className="text-sm">
            <span className="mb-1.5 block font-medium">Verification role</span>
            <div className="inline-flex rounded-lg border border-[var(--color-border-strong)] p-1">
              {(["PRIMARY", "SECONDARY"] as ContactType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, contact_type: t }))}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    form.contact_type === t ? "bg-[var(--color-gold)] text-[#1a1204]" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {formError && <ErrorBanner message={formError} />}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving} icon={<X className="h-4 w-4" />}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
