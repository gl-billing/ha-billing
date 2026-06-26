import { firmCopyrightLine } from "@/lib/firm-brand";

type Props = {
  className?: string;
};

/** Shared copyright line for firm app footers. */
export function FirmCopyright({ className = "" }: Props) {
  return <p className={className}>{firmCopyrightLine()}</p>;
}
