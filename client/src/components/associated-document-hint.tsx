import { Check } from "lucide-react";

type AssociatedDocumentHintProps = {
  label: string;
  reference: string;
};

export function AssociatedDocumentHint({ label, reference }: AssociatedDocumentHintProps) {
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-emerald-600">
      <Check className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        {label} · {reference}
      </span>
    </span>
  );
}
