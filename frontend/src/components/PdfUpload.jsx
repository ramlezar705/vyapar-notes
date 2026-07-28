import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePdf, UploadSimple, CircleNotch } from "@phosphor-icons/react";
import { uploadPdf, uploadStatus } from "@/lib/api";
import { toast } from "sonner";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const PdfUpload = ({ onDone }) => {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }
    setBusy(true);
    const t = toast.loading("Uploading PDF…");
    try {
      const { job_id } = await uploadPdf(file);
      toast.loading("Parsing PDF with AI… may take up to 2 minutes", { id: t });
      // poll status
      const started = Date.now();
      while (Date.now() - started < 240000) {
        await sleep(3000);
        const s = await uploadStatus(job_id);
        if (s.status === "done") {
          toast.success(`Imported ${s.inserted} entries from ${s.days} days`, { id: t });
          onDone && onDone(s);
          return;
        }
        if (s.status === "error") {
          toast.error(s.error || "Parsing failed", { id: t });
          return;
        }
      }
      toast.error("Timed out waiting for parsing. Refresh and try again.", { id: t });
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || "Upload failed";
      toast.error(msg, { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="pdf-upload-zone"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        handleFile(f);
      }}
      className={`relative rounded-xl border-2 border-dashed transition-colors p-4 sm:p-6 ${
        dragging ? "border-emerald-500 bg-emerald-50" : "border-neutral-300 bg-white"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <FilePdf size={26} weight="duotone" className="text-emerald-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 font-display">Import Apple Notes PDF</p>
          <p className="text-xs text-neutral-500 mt-0.5">Drag & drop, or click below. AI will read dates, items & pcs.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          data-testid="pdf-file-input"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          data-testid="upload-pdf-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="bg-[#0D5C46] hover:bg-[#0a4d3a] text-white rounded-full px-5 w-full sm:w-auto"
        >
          {busy ? <CircleNotch size={16} className="animate-spin mr-2" /> : <UploadSimple size={16} className="mr-2" weight="bold" />}
          {busy ? "Parsing…" : "Upload PDF"}
        </Button>
      </div>
    </div>
  );
};
