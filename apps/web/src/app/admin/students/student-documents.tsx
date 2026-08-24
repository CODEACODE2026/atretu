"use client";

import { useEffect, useState } from "react";
import type {
  ApiUser,
  StudentDocumentRecord,
  StudentDocumentType,
} from "../../../lib/api";
import { api } from "../../../lib/api";
import { adminTheme, cx } from "../admin-theme";
import { StudentOfficialDocuments } from "./student-official-documents";
import {
  canRenderImage,
  formatBytes,
  formatDateTime,
  revokeObjectUrl,
} from "./student-profile-utils";

const documentTypes: Array<{ label: string; value: StudentDocumentType }> = [
  { label: "CPF", value: "CPF" },
  { label: "RG", value: "RG" },
  { label: "Comprovante de residencia", value: "PROOF_OF_ADDRESS" },
  { label: "Comprovante de matricula", value: "PROOF_OF_ENROLLMENT" },
];

const maxDocumentSizeBytes = 8 * 1024 * 1024;

function hasFileExtension(file: File, extensions: string[]) {
  const lowerName = file.name.toLowerCase();
  return extensions.some((extension) => lowerName.endsWith(extension));
}

function isPhotoFile(file: File) {
  return (
    ["image/jpeg", "image/png"].includes(file.type) ||
    hasFileExtension(file, [".jpg", ".jpeg", ".png"])
  );
}

function isDocumentFile(file: File) {
  return (
    ["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
    hasFileExtension(file, [".pdf", ".jpg", ".jpeg", ".png"])
  );
}

export function StudentDocumentsTab({
  onChanged,
  onSummary,
  showLegacyDocuments,
  showOfficialDocuments,
  studentId,
  studentName,
  user,
}: {
  onChanged: () => Promise<void>;
  onSummary: (summary: { active: number; missing: number }) => void;
  showLegacyDocuments: boolean;
  showOfficialDocuments: boolean;
  studentId: string;
  studentName: string;
  user: ApiUser;
}) {
  return (
    <div className="grid gap-4">
      {showOfficialDocuments ? (
        <StudentOfficialDocuments studentId={studentId} studentName={studentName} user={user} />
      ) : null}
      {showLegacyDocuments ? (
        <>
          <StudentPhoto onChanged={onChanged} studentId={studentId} />
          <StudentDocuments
            onChanged={onChanged}
            onSummary={onSummary}
            studentId={studentId}
          />
        </>
      ) : null}
    </div>
  );
}

function StudentPhoto({
  onChanged,
  studentId,
}: {
  onChanged: () => Promise<void>;
  studentId: string;
}) {
  const [photo, setPhoto] = useState<StudentDocumentRecord | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadPhoto();
  }, [studentId]);

  useEffect(() => () => revokeObjectUrl(photoUrl), [photoUrl]);
  useEffect(() => () => revokeObjectUrl(previewUrl), [previewUrl]);

  async function loadPhoto() {
    setLoading(true);
    setError("");
    try {
      const response = await api.getStudentPhoto(studentId);
      setPhoto(response.photo);
      revokeObjectUrl(photoUrl);
      setPhotoUrl("");
      if (response.photo) {
        const { blob } = await api.downloadStudentPhoto(studentId, "inline");
        const nextPhotoUrl = URL.createObjectURL(blob);
        const canPreview = await canRenderImage(nextPhotoUrl);
        if (!canPreview) {
          revokeObjectUrl(nextPhotoUrl);
          setError("A foto ativa nao pode ser exibida. Envie um JPG ou PNG valido.");
          return;
        }
        setPhotoUrl(nextPhotoUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar foto");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(file: File | undefined) {
    setError("");
    setMessage("");
    revokeObjectUrl(previewUrl);
    setPreviewUrl("");
    setSelectedFile(null);
    if (!file) return;
    if (!isPhotoFile(file)) {
      setError("Selecione uma foto JPG, JPEG ou PNG.");
      return;
    }
    if (file.size > maxDocumentSizeBytes) {
      setError("A foto deve ter no maximo 8 MB.");
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    const canPreview = await canRenderImage(nextPreviewUrl);
    if (!canPreview) {
      setPreviewUrl("");
      revokeObjectUrl(nextPreviewUrl);
      setMessage("Foto selecionada. A previa nao pode ser exibida neste navegador.");
    }
  }

  async function savePhoto() {
    if (!selectedFile) {
      setError("Selecione uma foto oficial para enviar.");
      return;
    }
    if (photo && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    setSaving(true);
    setConfirmReplace(false);
    setMessage("");
    setError("");
    try {
      await api.uploadOrReplaceStudentPhoto(studentId, selectedFile);
      setMessage(photo ? "Foto oficial substituida." : "Foto oficial adicionada.");
      setSelectedFile(null);
      revokeObjectUrl(previewUrl);
      setPreviewUrl("");
      await loadPhoto();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao enviar foto");
    } finally {
      setSaving(false);
    }
  }

  async function removePhoto() {
    if (!photo) return;
    setSaving(true);
    setConfirmRemove(false);
    setMessage("");
    setError("");
    try {
      await api.removeStudentPhoto(studentId);
      setMessage("Foto oficial removida.");
      setPhoto(null);
      revokeObjectUrl(photoUrl);
      setPhotoUrl("");
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao remover foto");
    } finally {
      setSaving(false);
    }
  }

  const displayUrl = previewUrl || photoUrl;

  return (
    <section className={cx(adminTheme.card, "p-5")}>
      <Header title="Foto oficial" onRefresh={() => void loadPhoto()} loading={loading || saving} />
      <div className="mt-4 grid gap-4 md:grid-cols-[128px_1fr]">
        <div className="flex h-44 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Foto oficial do academico" className="h-full w-full object-cover" src={displayUrl} />
          ) : (
            <span className="px-3 text-center text-xs text-slate-500">Sem foto oficial</span>
          )}
        </div>
        <div className="grid content-start gap-3">
          {photo ? (
            <p className="text-sm text-slate-600">
              Foto ativa: {photo.extension.toUpperCase()} · {formatBytes(photo.sizeBytes)} · {formatDateTime(photo.createdAt)}
            </p>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              A foto e opcional. Sem foto, a carteirinha usa area padrao.
            </p>
          )}
          <input
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0F2E2E] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
            disabled={saving}
            onChange={(event) => {
              void handleSelect(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
            type="file"
          />
          {selectedFile ? (
            <p className="text-xs font-medium text-slate-600">
              Selecionado: {selectedFile.name} · {formatBytes(selectedFile.size)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button className={adminTheme.primaryButton} disabled={saving || !selectedFile} onClick={() => void savePhoto()} type="button">
              {photo ? "Substituir foto" : "Adicionar foto"}
            </button>
            {photo ? (
              <button className={adminTheme.secondaryButton} disabled={saving} onClick={() => setConfirmRemove(true)} type="button">
                Remover foto
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <Messages error={error} message={message} />
      {confirmReplace ? (
        <InlineConfirm
          danger={false}
          message="A foto oficial atual sera substituida."
          onCancel={() => setConfirmReplace(false)}
          onConfirm={() => void savePhoto()}
        />
      ) : null}
      {confirmRemove ? (
        <InlineConfirm
          danger
          message="A foto oficial sera removida logicamente."
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => void removePhoto()}
        />
      ) : null}
    </section>
  );
}

function StudentDocuments({
  onChanged,
  onSummary,
  studentId,
}: {
  onChanged: () => Promise<void>;
  onSummary: (summary: { active: number; missing: number }) => void;
  studentId: string;
}) {
  const [documents, setDocuments] = useState<StudentDocumentRecord[]>([]);
  const [pendingReplace, setPendingReplace] = useState<{
    activeDocument: StudentDocumentRecord;
    file: File;
    type: StudentDocumentType;
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<
    Partial<Record<StudentDocumentType, File>>
  >({});
  const [pendingRemove, setPendingRemove] = useState<StudentDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<StudentDocumentType | "download" | "remove" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadDocuments();
  }, [studentId]);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listStudentDocuments(studentId, { status: "all" });
      setDocuments(response.data);
      onSummary({
        active: response.data.filter((item) => item.status === "ACTIVE").length,
        missing: response.missingTypes.length,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(
    documentType: StudentDocumentType,
    file: File,
    activeDocument?: StudentDocumentRecord,
  ) {
    setBusyType(documentType);
    setMessage("");
    setError("");
    try {
      if (activeDocument) {
        await api.replaceStudentDocument(studentId, activeDocument.id, file);
        setMessage("Documento substituido.");
      } else {
        await api.uploadStudentDocument(studentId, documentType, file);
        setMessage("Documento enviado.");
      }
      setSelectedFiles((current) => ({ ...current, [documentType]: undefined }));
      await loadDocuments();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao enviar arquivo");
    } finally {
      setBusyType("");
      setPendingReplace(null);
    }
  }

  function selectFile(documentType: StudentDocumentType, file: File | undefined) {
    setMessage("");
    setError("");
    if (!file) {
      setSelectedFiles((current) => ({ ...current, [documentType]: undefined }));
      return;
    }
    if (!isDocumentFile(file)) {
      setSelectedFiles((current) => ({ ...current, [documentType]: undefined }));
      setError("Selecione um arquivo PDF, JPG, JPEG ou PNG.");
      return;
    }
    if (file.size > maxDocumentSizeBytes) {
      setSelectedFiles((current) => ({ ...current, [documentType]: undefined }));
      setError("O documento deve ter no maximo 8 MB.");
      return;
    }
    setSelectedFiles((current) => ({ ...current, [documentType]: file }));
  }

  async function submitFile(
    documentType: StudentDocumentType,
    activeDocument?: StudentDocumentRecord,
  ) {
    const file = selectedFiles[documentType];
    if (!file) {
      setError("Selecione um arquivo antes de enviar.");
      return;
    }
    if (activeDocument) {
      setPendingReplace({ activeDocument, file, type: documentType });
      return;
    }
    await uploadFile(documentType, file);
  }

  async function handleDownload(
    studentDocument: StudentDocumentRecord,
    disposition: "attachment" | "inline",
  ) {
    setBusyType("download");
    setMessage("");
    setError("");
    try {
      const { blob, fileName } = await api.downloadStudentDocument(
        studentId,
        studentDocument.id,
        disposition,
      );
      const objectUrl = URL.createObjectURL(blob);
      if (disposition === "inline") {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(objectUrl);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao baixar documento");
    } finally {
      setBusyType("");
    }
  }

  async function removeDocument() {
    if (!pendingRemove) return;
    setBusyType("remove");
    setMessage("");
    setError("");
    try {
      await api.removeStudentDocument(studentId, pendingRemove.id);
      setMessage("Documento removido.");
      await loadDocuments();
      await onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao remover documento");
    } finally {
      setBusyType("");
      setPendingRemove(null);
    }
  }

  return (
    <section className={cx(adminTheme.card, "p-5")}>
      <Header title="Documentos" onRefresh={() => void loadDocuments()} loading={loading} />
      <Messages error={error} message={message} />
      <div className="mt-4 grid gap-3">
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Carregando documentos...</p>
        ) : (
          documentTypes.map((item) => {
            const activeDocument = documents.find(
              (documentItem) =>
                documentItem.documentType === item.value &&
                documentItem.status === "ACTIVE",
            );
            const history = documents.filter(
              (documentItem) =>
                documentItem.documentType === item.value &&
                documentItem.status !== "ACTIVE",
            );
            return (
              <div className={cx(adminTheme.softPanel, "p-4")} key={item.value}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {activeDocument
                        ? `${activeDocument.extension.toUpperCase()} · ${formatBytes(activeDocument.sizeBytes)} · ${formatDateTime(activeDocument.createdAt)}`
                        : "Documento ausente"}
                    </p>
                  </div>
                  <span className={cx("w-fit rounded-full border px-2.5 py-1 text-xs font-semibold", activeDocument ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600")}>
                    {activeDocument ? "Ativo" : "Ausente"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  <input
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0F2E2E] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                    disabled={busyType === item.value}
                    onChange={(event) => {
                      selectFile(item.value, event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                  {selectedFiles[item.value] ? (
                    <p className="text-xs font-medium text-slate-600">
                      Selecionado: {selectedFiles[item.value]?.name} ·{" "}
                      {formatBytes(selectedFiles[item.value]?.size ?? 0)}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={adminTheme.primaryButton}
                      disabled={busyType !== "" || !selectedFiles[item.value]}
                      onClick={() => void submitFile(item.value, activeDocument)}
                      type="button"
                    >
                      {busyType === item.value
                        ? "Enviando..."
                        : activeDocument
                          ? "Substituir"
                          : "Enviar"}
                    </button>
                    {selectedFiles[item.value] ? (
                      <button
                        className={adminTheme.secondaryButton}
                        disabled={busyType !== ""}
                        onClick={() =>
                          setSelectedFiles((current) => ({
                            ...current,
                            [item.value]: undefined,
                          }))
                        }
                        type="button"
                      >
                        Limpar
                      </button>
                    ) : null}
                    {activeDocument ? (
                      <>
                        <button className={adminTheme.secondaryButton} disabled={busyType !== ""} onClick={() => void handleDownload(activeDocument, "inline")} type="button">Visualizar</button>
                        <button className={adminTheme.secondaryButton} disabled={busyType !== ""} onClick={() => void handleDownload(activeDocument, "attachment")} type="button">Baixar</button>
                        <button className={adminTheme.secondaryButton} disabled={busyType !== ""} onClick={() => setPendingRemove(activeDocument)} type="button">Remover</button>
                      </>
                    ) : null}
                  </div>
                </div>
                {history.length > 0 ? (
                  <details className="mt-3 text-sm text-slate-600">
                    <summary className="cursor-pointer font-semibold">Historico</summary>
                    <div className="mt-2 grid gap-1">
                      {history.map((documentItem) => (
                        <p key={documentItem.id}>
                          {documentItem.status} · {documentItem.extension.toUpperCase()} · {formatDateTime(documentItem.updatedAt)}
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {pendingReplace ? (
        <InlineConfirm
          danger={false}
          message="O documento ativo sera substituido pelo novo arquivo."
          onCancel={() => setPendingReplace(null)}
          onConfirm={() => void uploadFile(pendingReplace.type, pendingReplace.file, pendingReplace.activeDocument)}
        />
      ) : null}
      {pendingRemove ? (
        <InlineConfirm
          danger
          message="Este documento sera removido logicamente."
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => void removeDocument()}
        />
      ) : null}
    </section>
  );
}

function Header({
  loading,
  onRefresh,
  title,
}: {
  loading: boolean;
  onRefresh: () => void;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <button className={adminTheme.secondaryButton} disabled={loading} onClick={onRefresh} type="button">
        Atualizar
      </button>
    </div>
  );
}

function Messages({ error, message }: { error: string; message: string }) {
  return (
    <>
      {message ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
    </>
  );
}

function InlineConfirm({
  danger,
  message,
  onCancel,
  onConfirm,
}: {
  danger: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={cx("mt-4 rounded-xl border p-4", danger ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")}>
      <p className={cx("text-sm font-semibold", danger ? "text-red-800" : "text-amber-800")}>{message}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={adminTheme.secondaryButton} onClick={onCancel} type="button">Cancelar</button>
        <button className={danger ? adminTheme.primaryButton : adminTheme.secondaryButton} onClick={onConfirm} type="button">Confirmar</button>
      </div>
    </div>
  );
}
