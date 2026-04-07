import type { ParseError } from "@/lib/views/ast";
import { QueryCodeEditor } from "./query-code-editor";

type QueryEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error: ParseError | null;
  resultCount: number | null;
  timing: number;
};

export function QueryEditor(props: QueryEditorProps) {
  return <QueryCodeEditor {...props} />;
}
