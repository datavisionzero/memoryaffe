import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
export default function Editor({
  value,
  theme,
  onChange,
}: {
  value: string;
  theme: "light" | "dark";
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      theme={theme}
      extensions={[markdown()]}
      height="450px"
      onChange={onChange}
    />
  );
}
