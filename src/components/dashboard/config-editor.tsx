import { ArrowDownToLine, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ConfigFile } from "@/lib/types";
export type Editor = ConfigFile & {
  id: string;
  file: number;
  name: string;
  serverName: string;
  original: string;
};

type Props = {
  editor: Editor | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChange: (text: string) => void;
};
export function ConfigEditor({
  editor,
  saving,
  error,
  onClose,
  onSave,
  onChange,
}: Props) {
  const dirty = editor !== null && editor.text !== editor.original;
  if (!editor) return null;
  return (
    <section
      aria-label="Editor configurazione"
      className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6"
    >
      <div>
        <h3 className="break-all font-semibold">{editor.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {editor?.editable
            ? "Le modifiche saranno applicate al prossimo avvio."
            : "Sola lettura. Arresta il server e riapri il file per modificarlo."}
        </p>
      </div>
      <Textarea
        aria-label="Contenuto configurazione"
        spellCheck={false}
        readOnly={!editor?.editable || saving}
        value={editor?.text || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-[45dvh] min-h-64 resize-y overflow-auto bg-background font-mono text-xs leading-6 whitespace-pre"
      />
      <p role="status" className="text-sm text-rose-300">
        {error}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" disabled={saving} onClick={onClose}>
          Chiudi
        </Button>
        <Button
          disabled={!editor?.editable || saving || !dirty}
          onClick={() => void onSave()}
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ArrowDownToLine className="size-4" />
          )}
          Salva modifiche
        </Button>
      </div>
    </section>
  );
}
