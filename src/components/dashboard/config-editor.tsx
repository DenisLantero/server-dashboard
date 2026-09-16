import { ArrowDownToLine, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  return (
    <Dialog
      open={editor !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <p className="mb-2 text-xs text-violet-400">
            {editor?.serverName} / Configurazione
          </p>
          <DialogTitle className="break-all pr-5">{editor?.name}</DialogTitle>
          <DialogDescription>
            {editor?.editable
              ? "Salva le modifiche e avvia il server per applicarle. La versione precedente viene conservata in un backup."
              : "Il server è acceso o sta cambiando stato. Spegnilo e riapri il file per modificarlo."}
          </DialogDescription>
        </DialogHeader>
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
        <DialogFooter className="items-center gap-3">
          <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Backup automatico
          </span>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
