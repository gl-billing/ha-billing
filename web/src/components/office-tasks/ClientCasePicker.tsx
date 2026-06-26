"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { ClientCodeWarningPanel } from "@/components/ClientCodeWarningPanel";
import { ClientContactEmailField } from "@/components/office-tasks/ClientContactEmailField";
import { useClientCodeCheck } from "@/hooks/useClientCodeCheck";
import { contactEmailsToFieldValue, formatContactEmails, parseContactEmails } from "@/lib/contact-emails";
import type { CaseOption } from "@/lib/gl-config";
import { sortCaseOptionsByClientCode } from "@/lib/gl-config";
import { formatClientCaseLabel } from "@/lib/gl-config";
import type { PrefixCollisionMatch } from "@/lib/sheets/prefix-collision";
import {
  clientCodeCheckCanProceed,
  collisionWarningMessage,
  conflictReviewBlocksProceed,
  type ClientCodeCheckResult,
  type ConflictReviewChoice
} from "@/lib/sheets/client-code-check";

type Mode = "select" | "manual" | "new-walkin" | "new-client";

export type ClientCasePickerHandle = {
  /** Client/case label for validation before billing file creation. */
  getPendingClientCaseLabel: () => string;
  /** Returns an error when the picker is incomplete — call before creating a billing file. */
  validateClientSelection: () => string | null;
  /** Ensures a client/case label is ready — creates walk-in or client file if needed. */
  resolveClientCase: () => Promise<string | null>;
  /** Contact emails currently entered or loaded for the selected client / walk-in. */
  getContactEmails: () => string[];
  /** Focus the primary client/case control. */
  focus: () => void;
};

type Props = {
  name?: string;
  required?: boolean;
  highlight?: boolean;
  defaultValue?: string;
  billingAccess?: boolean;
  /** Shown in the new-client panel, e.g. "Add event" or "Add task". */
  submitActionLabel?: string;
  onStatus?: (message: string, isError?: boolean) => void;
  onCaseSelect?: (option: CaseOption | null) => void;
  /** + Task / + Event only — sort dropdown A–Z by client code. */
  sortByClientCode?: boolean;
  /** + Event — phone and email sit in a half-width column beside each other. */
  compactContactLayout?: boolean;
  /** Focus the client/case dropdown when the form opens. */
  autoFocusOnMount?: boolean;
};

const SELECT_PLACEHOLDER = "";
const MANUAL_VALUE = "__manual__";
const NEW_WALKIN_VALUE = "__new_walkin__";
const NEW_CLIENT_VALUE = "__new_client__";

export const ClientCasePicker = forwardRef<ClientCasePickerHandle, Props>(function ClientCasePicker(
  {
    name = "clientCase",
    required = true,
    highlight = false,
    defaultValue = "",
    billingAccess = true,
    submitActionLabel = "Add task",
    onStatus,
    onCaseSelect,
    sortByClientCode = false,
    compactContactLayout = false,
    autoFocusOnMount = false
  },
  ref
) {
  const pickerId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  useFocusOnMount(selectRef, autoFocusOnMount);
  const [loading, setLoading] = useState(true);
  const [masterCases, setMasterCases] = useState<CaseOption[]>([]);
  const [walkInCases, setWalkInCases] = useState<CaseOption[]>([]);
  const [firmCases, setFirmCases] = useState<CaseOption[]>([]);
  const [mode, setMode] = useState<Mode>(defaultValue ? "manual" : "select");
  const [selected, setSelected] = useState(defaultValue ? MANUAL_VALUE : SELECT_PLACEHOLDER);
  const [clientCase, setClientCase] = useState(defaultValue);
  const [manualValue, setManualValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);

  const [walkInName, setWalkInName] = useState("");
  const [walkInMatter, setWalkInMatter] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInEmails, setWalkInEmails] = useState<string[]>([""]);

  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [clientContactEmails, setClientContactEmails] = useState<string[]>([""]);
  const [selectedContactEmails, setSelectedContactEmails] = useState<string[]>([""]);

  const collisionInput = useMemo(() => {
    if (mode === "new-client") {
      return { clientCode, clientName, caseTitle };
    }
    if (mode === "new-walkin") {
      return { clientName: walkInName, caseTitle: walkInMatter };
    }
    if (mode === "manual") {
      return { clientCaseLabel: manualValue };
    }
    return { clientCaseLabel: clientCase };
  }, [mode, clientCode, clientName, caseTitle, walkInName, walkInMatter, manualValue, clientCase]);

  const {
    check: collisionCheck,
    checking: collisionChecking,
    runCheck: runCollisionCheck,
    conflictReviewChoice,
    setConflictReviewChoice
  } = useClientCodeCheck(collisionInput);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/case-options");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load cases.");
      setMasterCases(json.clients?.filter((o: CaseOption) => o.kind !== "firm") || json.clients || []);
      setWalkInCases(json.walkIns || []);
      setFirmCases(json.firmMatters || json.clients?.filter((o: CaseOption) => o.kind === "firm") || []);

      if (defaultValue) {
        const all = [...firmCases, ...(json.clients || []), ...(json.walkIns || [])] as CaseOption[];
        const match = all.find((o) => o.label === defaultValue);
        if (match) {
          setSelected(match.label);
          setClientCase(match.label);
          setMode("select");
          setSelectedContactEmails(contactEmailsToFieldValue(match.email || ""));
        }
      }
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not load cases.", true);
    } finally {
      setLoading(false);
    }
  }, [defaultValue, onStatus]);

  const allCaseOptions = useMemo(
    () => [...firmCases, ...masterCases, ...walkInCases],
    [firmCases, masterCases, walkInCases]
  );

  const sortedFirmCases = useMemo(
    () => (sortByClientCode ? sortCaseOptionsByClientCode(firmCases) : firmCases),
    [firmCases, sortByClientCode]
  );

  const sortedMasterCases = useMemo(
    () => (sortByClientCode ? sortCaseOptionsByClientCode(masterCases) : masterCases),
    [masterCases, sortByClientCode]
  );

  const sortedWalkInCases = useMemo(
    () => (sortByClientCode ? sortCaseOptionsByClientCode(walkInCases) : walkInCases),
    [walkInCases, sortByClientCode]
  );

  function findCaseOption(label: string): CaseOption | null {
    if (!label) return null;
    return allCaseOptions.find((option) => option.label === label) || null;
  }

  function notifyCaseSelect(label: string) {
    const option = findCaseOption(label);
    onCaseSelect?.(option);
    setSelectedContactEmails(contactEmailsToFieldValue(option?.email || ""));
  }

  function patchCaseOptionEmail(label: string, emails: string[]) {
    const nextEmail = formatContactEmails(emails);
    const patch = (options: CaseOption[]) =>
      options.map((option) => (option.label === label ? { ...option, email: nextEmail || undefined } : option));
    setMasterCases((current) => patch(current));
    setWalkInCases((current) => patch(current));
    setSelectedContactEmails(contactEmailsToFieldValue(nextEmail));
  }

  async function saveSelectedClientEmails(emails: string[]): Promise<void> {
    const nextEmail = formatContactEmails(emails);
    const option = findCaseOption(clientCase);
    if (!option) throw new Error("Select a client / case first.");

    if (option.kind === "master" && option.clientCode) {
      const res = await fetch(`/api/clients/${encodeURIComponent(option.clientCode)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactEmail: nextEmail })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save email.");
      patchCaseOptionEmail(option.label, emails);
      onStatus?.(`Email saved for ${option.clientCode}.`);
      return;
    }

    if (option.kind === "walkin" && option.walkInId) {
      const res = await fetch(`/api/tasks/walk-ins/${encodeURIComponent(option.walkInId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save email.");
      patchCaseOptionEmail(option.label, emails);
      onStatus?.(`Email saved for walk-in ${option.walkInId}.`);
      return;
    }

    throw new Error("Email can only be saved for Master List clients or walk-ins.");
  }

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  function applyClientCase(value: string) {
    setClientCase(value);
  }

  function handleSelectChange(value: string) {
    setSelected(value);
    if (value === MANUAL_VALUE) {
      setMode("manual");
      applyClientCase(manualValue);
      onCaseSelect?.(null);
      return;
    }
    if (value === NEW_WALKIN_VALUE) {
      setMode("new-walkin");
      applyClientCase("");
      onCaseSelect?.(null);
      return;
    }
    if (value === NEW_CLIENT_VALUE) {
      setMode("new-client");
      applyClientCase("");
      onCaseSelect?.(null);
      return;
    }
    if (!value) {
      setMode("select");
      applyClientCase("");
      setSelectedContactEmails([""]);
      onCaseSelect?.(null);
      return;
    }
    setMode("select");
    applyClientCase(value);
    notifyCaseSelect(value);
  }

  const createWalkInRecord = useCallback(async (): Promise<string> => {
    if (!walkInName.trim() || !walkInMatter.trim()) {
      throw new Error("Enter the walk-in name and consultation topic.");
    }
    const res = await fetch("/api/tasks/walk-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: walkInName.trim(),
        matter: walkInMatter.trim(),
        phone: walkInPhone.trim(),
        email: formatContactEmails(walkInEmails)
      })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not save walk-in.");
    const label = String(json.clientCase || formatClientCaseLabel(walkInName.trim(), walkInMatter.trim()));
    await loadOptions();
    setSelected(label);
    setMode("select");
    applyClientCase(label);
    setWalkInName("");
    setWalkInMatter("");
    setWalkInPhone("");
    setWalkInEmails([""]);
    return label;
  }, [walkInEmails, walkInMatter, walkInName, walkInPhone, loadOptions]);

  const applyExistingClientLabel = useCallback(
    (match: PrefixCollisionMatch) => {
      const label = formatClientCaseLabel(match.name, match.caseTitle);
      setSelected(label);
      setMode("select");
      applyClientCase(label);
      notifyCaseSelect(label);
      setClientCode("");
      setClientName("");
      setCaseTitle("");
      setConflictReviewChoice("same_case");
      return label;
    },
    [notifyCaseSelect, setConflictReviewChoice]
  );

  const handleUseExistingCode = useCallback(
    (code: string) => {
      const match = collisionCheck?.prefixMatches.find((row) => row.code.toUpperCase() === code.toUpperCase());
      if (!match) return;
      if (mode === "new-client") {
        setClientCode(match.code);
        setConflictReviewChoice("same_case");
        void runCollisionCheck();
        return;
      }
      const label = applyExistingClientLabel(match);
      onStatus?.(`Using existing client ${code} — ${label}.`);
    },
    [applyExistingClientLabel, collisionCheck?.prefixMatches, mode, onStatus, runCollisionCheck, setConflictReviewChoice]
  );

  function collisionSelectionError(
    result: ClientCodeCheckResult | null = collisionCheck,
    reviewChoice: ConflictReviewChoice | null = conflictReviewChoice
  ): string | null {
    if (!billingAccess) return null;
    if (mode !== "new-client" && mode !== "manual" && mode !== "new-walkin") return null;
    if (!result) return null;
    if (clientCodeCheckCanProceed(result, reviewChoice)) return null;
    return (
      conflictReviewBlocksProceed(reviewChoice) ||
      collisionWarningMessage(result) ||
      "Review the possible conflict and choose whether this is the same case or a different case."
    );
  }

  const performCreateClientFile = useCallback(async (): Promise<string> => {
    if (!clientCode.trim() || !clientName.trim() || !caseTitle.trim()) {
      throw new Error("Client code, name, and case title are required.");
    }
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientCode: clientCode.trim(),
        clientName: clientName.trim(),
        caseTitle: caseTitle.trim(),
        contactEmail: formatContactEmails(clientContactEmails),
        clientStatus: "Active"
      })
    });
    const json = await res.json();
    const label = formatClientCaseLabel(clientName.trim(), caseTitle.trim());
    if (!res.ok) {
      const message = String(json.error || "Could not create client file.");
      if (/already exists/i.test(message)) {
        await loadOptions();
        setSelected(label);
        setMode("select");
        applyClientCase(label);
        notifyCaseSelect(label);
        setClientCode("");
        setClientName("");
        setCaseTitle("");
        onStatus?.(`Client ${clientCode.trim()} already exists — continuing with ${label}.`);
        return label;
      }
      throw new Error(message);
    }
    await loadOptions();
    setSelected(label);
    setMode("select");
    applyClientCase(label);
    notifyCaseSelect(label);
    setClientCode("");
    setClientName("");
    setCaseTitle("");
    setClientContactEmails([""]);
    return label;
  }, [caseTitle, clientCode, clientContactEmails, clientName, loadOptions, notifyCaseSelect, onStatus]);

  const createClientFileRecord = useCallback(async (): Promise<string> => {
    const latest = await runCollisionCheck();
    const collisionError = collisionSelectionError(latest, conflictReviewChoice);
    if (collisionError) {
      throw new Error(collisionError);
    }
    return performCreateClientFile();
  }, [conflictReviewChoice, collisionSelectionError, performCreateClientFile, runCollisionCheck]);

  function getContactEmails(): string[] {
    if (mode === "new-walkin") {
      return parseContactEmails(formatContactEmails(walkInEmails));
    }
    if (mode === "new-client") {
      return parseContactEmails(formatContactEmails(clientContactEmails));
    }
    if (mode === "select") {
      const fromState = parseContactEmails(formatContactEmails(selectedContactEmails));
      if (fromState.length) return fromState;
      const option = findCaseOption(clientCase);
      return parseContactEmails(option?.email || "");
    }
    return [];
  }

  useImperativeHandle(
    ref,
    () => ({
      getPendingClientCaseLabel() {
        if (mode === "new-client") {
          return formatClientCaseLabel(clientName.trim(), caseTitle.trim());
        }
        if (mode === "new-walkin") {
          return formatClientCaseLabel(walkInName.trim(), walkInMatter.trim());
        }
        return clientCase.trim() || (mode === "manual" ? manualValue.trim() : "");
      },
      validateClientSelection() {
        if (mode === "new-walkin") {
          if (!walkInName.trim() || !walkInMatter.trim()) {
            return "Enter the walk-in name and consultation topic.";
          }
          return collisionSelectionError();
        }
        if (mode === "new-client") {
          if (!billingAccess) return "Billing access is required to create a client file.";
          if (!clientCode.trim() || !clientName.trim() || !caseTitle.trim()) {
            return "Client code, name, and case title are required.";
          }
          return collisionSelectionError();
        }
        const value = clientCase.trim() || (mode === "manual" ? manualValue.trim() : "");
        if (!value) return "Select or enter a client / case before saving.";
        if (mode === "manual") {
          return collisionSelectionError();
        }
        return null;
      },
      async resolveClientCase() {
        const latest = await runCollisionCheck();
        const collisionError = collisionSelectionError(latest, conflictReviewChoice);
        if (collisionError) {
          throw new Error(collisionError);
        }

        if (mode === "new-walkin") {
          if (!walkInName.trim() || !walkInMatter.trim()) return null;
          setBusy(true);
          try {
            return await createWalkInRecord();
          } finally {
            setBusy(false);
          }
        }
        if (mode === "new-client") {
          if (!clientCode.trim() || !clientName.trim() || !caseTitle.trim()) return null;
          setBusy(true);
          try {
            return await createClientFileRecord();
          } finally {
            setBusy(false);
          }
        }
        const value = clientCase.trim() || (mode === "manual" ? manualValue.trim() : "");
        return value || null;
      },
      getContactEmails,
      focus: () => selectRef.current?.focus()
    }),
    [
      conflictReviewChoice,
      billingAccess,
      clientCase,
      clientCode,
      clientContactEmails,
      clientName,
      caseTitle,
      collisionSelectionError,
      createClientFileRecord,
      createWalkInRecord,
      getContactEmails,
      manualValue,
      mode,
      runCollisionCheck,
      selectedContactEmails,
      walkInEmails,
      walkInMatter,
      walkInName
    ]
  );

  const collisionPanel = billingAccess ? (
    <ClientCodeWarningPanel
      check={collisionCheck}
      checking={collisionChecking}
      clientCode={clientCode}
      clientCaseLabel={mode === "manual" ? manualValue : mode === "new-walkin" ? formatClientCaseLabel(walkInName, walkInMatter) : clientCase}
      context="task-event"
      conflictReviewChoice={conflictReviewChoice}
      onConflictReviewChoiceChange={setConflictReviewChoice}
      onUseExistingCode={handleUseExistingCode}
    />
  ) : null;

  async function createWalkIn() {
    setBusy(true);
    try {
      const label = await createWalkInRecord();
      onStatus?.(`Walk-in saved — using ${label}.`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not save walk-in.", true);
    } finally {
      setBusy(false);
    }
  }

  async function createClientFile() {
    setBusy(true);
    try {
      const label = await createClientFileRecord();
      onStatus?.(`Billing file created (${label}). Click ${submitActionLabel} below to save the event or task.`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not create client file.", true);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = [
    "field-input",
    highlight ? "field-input--highlight" : ""
  ]
    .filter(Boolean)
    .join(" ");

  const totalCases = masterCases.length + walkInCases.length + firmCases.length;
  const selectedCaseOption = mode === "select" ? findCaseOption(clientCase) : null;
  const showSelectedContactEmail =
    billingAccess &&
    mode === "select" &&
    selectedCaseOption &&
    (selectedCaseOption.kind === "master" || selectedCaseOption.kind === "walkin");
  const selectValue =
    mode === "select"
      ? selected
      : mode === "manual"
        ? MANUAL_VALUE
        : mode === "new-walkin"
          ? NEW_WALKIN_VALUE
          : mode === "new-client"
            ? NEW_CLIENT_VALUE
            : selected;

  return (
    <div className={`client-case-picker ${highlight ? "client-case-picker--highlight" : ""}`}>
      <label className={`form-field ${highlight ? "form-field--highlight" : ""}`} htmlFor={pickerId}>
        <span className="form-field__label">
          Client / case
          {required ? <span className="form-field__required"> *</span> : null}
        </span>
        <select
          ref={selectRef}
          id={pickerId}
          className={inputClass}
          value={selectValue}
          disabled={loading || busy}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          <option value={SELECT_PLACEHOLDER}>
            {loading ? "Loading cases…" : totalCases ? "Select a case…" : "No cases yet — add below"}
          </option>
          {sortedFirmCases.length ? (
            <optgroup label="Firm work (office &amp; admin)">
              {sortedFirmCases.map((option) => (
                <option key={option.id} value={option.label}>
                  {option.clientCode ? `${option.clientCode} — ` : ""}
                  {option.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {sortedMasterCases.length ? (
            <optgroup label="Client files (Master List)">
              {sortedMasterCases.map((option) => (
                <option key={option.id} value={option.label}>
                  {option.clientCode ? `${option.clientCode} — ` : ""}
                  {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {sortedWalkInCases.length ? (
            <optgroup label="Walk-in clients">
              {sortedWalkInCases.map((option) => (
                <option key={option.id} value={option.label}>
                  {option.walkInId} — {option.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Not listed?">
            <option value={NEW_WALKIN_VALUE}>+ Add walk-in consultation</option>
            {billingAccess ? (
              <option value={NEW_CLIENT_VALUE}>+ Create full client file</option>
            ) : null}
            <option value={MANUAL_VALUE}>Type manually</option>
          </optgroup>
        </select>
      </label>

      {showSelectedContactEmail ? (
        compactContactLayout ? (
          <div className="client-case-picker__field-grid client-case-picker__field-grid--contact">
            <div className="form-field">
              <span className="form-field__label">Phone</span>
              <input
                className="field-input"
                value={selectedCaseOption?.phone || ""}
                disabled
                placeholder="—"
                readOnly
              />
            </div>
            <ClientContactEmailField
              compact
              emails={selectedContactEmails}
              disabled={busy}
              onEmailsChange={setSelectedContactEmails}
              onSave={saveSelectedClientEmails}
            />
          </div>
        ) : (
          <ClientContactEmailField
            emails={selectedContactEmails}
            disabled={busy}
            hint="Add another email if the client has more than one. Saved to the client file for billing and confirmations."
            onEmailsChange={setSelectedContactEmails}
            onSave={saveSelectedClientEmails}
          />
        )
      ) : null}

      {mode === "manual" ? (
        <label className="form-field client-case-picker__manual">
          <span className="form-field__label">Manual client / case label</span>
          <input
            className={inputClass}
            value={manualValue}
            required={required}
            placeholder="Client name or matter title"
            onChange={(e) => {
              setManualValue(e.target.value);
              applyClientCase(e.target.value);
            }}
            onBlur={() => void runCollisionCheck()}
          />
        </label>
      ) : null}

      {mode === "manual" ? collisionPanel : null}

      {mode === "new-walkin" ? (
        <div className="client-case-picker__panel">
          <p className="client-case-picker__panel-title">New walk-in consultation</p>
          <p className="client-case-picker__panel-hint">
            Fill in name and topic, then click <strong>Add task</strong> — the walk-in is saved automatically.
            You can promote it to a full client file later from Billing → Walk-ins.
          </p>
          <div className="client-case-picker__field-grid">
            <div className="form-field">
              <span className="form-field__label">Name *</span>
              <input
                className="field-input"
                value={walkInName}
                disabled={busy}
                placeholder="Visitor / client name"
                onChange={(e) => setWalkInName(e.target.value)}
                onBlur={() => void runCollisionCheck()}
              />
            </div>
            <div className="form-field">
              <span className="form-field__label">Consultation topic *</span>
              <input
                className="field-input"
                value={walkInMatter}
                disabled={busy}
                placeholder="e.g. Initial consultation — labor case"
                onChange={(e) => setWalkInMatter(e.target.value)}
                onBlur={() => void runCollisionCheck()}
              />
            </div>
            <div className="form-field">
              <span className="form-field__label">Phone</span>
              <input
                className="field-input"
                value={walkInPhone}
                disabled={busy}
                onChange={(e) => setWalkInPhone(e.target.value)}
              />
            </div>
            <ClientContactEmailField
              compact
              emails={walkInEmails}
              disabled={busy}
              onEmailsChange={setWalkInEmails}
            />
          </div>
          <div className="btn-row client-case-picker__action">
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void createWalkIn()}>
              {busy ? "Saving…" : "Save walk-in only (optional)"}
            </button>
          </div>
          {collisionPanel}
        </div>
      ) : null}

      {mode === "new-client" && billingAccess ? (
        <div className="client-case-picker__panel">
          <p className="client-case-picker__panel-title">Create full client file</p>
          <p className="client-case-picker__panel-hint">
            Fill in the fields below, then click <strong>{submitActionLabel}</strong> at the bottom — the billing
            client file is created automatically, then your event or task is saved.
          </p>
          <div className="form-grid form-grid--2">
            <label className="form-field">
              <span className="form-field__label">Client code *</span>
              <input
                className="field-input"
                value={clientCode}
                disabled={busy}
                placeholder="e.g. CRUZ2026"
                onChange={(e) => setClientCode(e.target.value.toUpperCase())}
                onBlur={() => void runCollisionCheck()}
              />
            </label>
            <label className="form-field">
              <span className="form-field__label">Client name *</span>
              <input
                className="field-input"
                value={clientName}
                disabled={busy}
                onChange={(e) => setClientName(e.target.value)}
                onBlur={() => void runCollisionCheck()}
              />
            </label>
          </div>
          <label className="form-field">
            <span className="form-field__label">Case title *</span>
            <input
              className="field-input"
              value={caseTitle}
              disabled={busy}
              placeholder="Matter description"
              onChange={(e) => setCaseTitle(e.target.value)}
              onBlur={() => void runCollisionCheck()}
            />
          </label>
          <ClientContactEmailField
            emails={clientContactEmails}
            disabled={busy}
            hint="Add another email if the client has more than one. Stored on the new client file when you save."
            onEmailsChange={setClientContactEmails}
          />
          <div className="btn-row client-case-picker__action">
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => void createClientFile()}>
              {busy ? "Creating…" : "Create billing file only (optional)"}
            </button>
          </div>
          <p className="client-case-picker__panel-hint mt-2 text-xs">
            That button only adds the client to <strong>Billing</strong>. You still need to click{" "}
            <strong>{submitActionLabel}</strong> to save the hearing or task.
          </p>
          {collisionPanel}
        </div>
      ) : null}

      <input type="hidden" name={name} value={clientCase} readOnly />
    </div>
  );
});
