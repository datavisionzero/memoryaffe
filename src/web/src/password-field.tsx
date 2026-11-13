import { useId, useState } from "react";

// JSON Schema counts Unicode code points; HTML length attributes count UTF-16 units.
export function PasswordField({
  label,
  name,
  isNew = false,
  en = false,
}: {
  label: string;
  name: string;
  isNew?: boolean;
  en?: boolean;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const rule = en
    ? isNew ? "Use 15 to 128 characters." : "Use 1 to 128 characters."
    : isNew ? "Verwende 15 bis 128 Zeichen." : "Verwende 1 bis 128 Zeichen.";
  function validate(input: HTMLInputElement) {
    const length = Array.from(input.value).length;
    const message = length < (isNew ? 15 : 1) || length > 128
      ? `${en ? "Password" : "Passwort"}: ${rule}`
      : "";
    input.setCustomValidity(message);
    return message;
  }
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="password"
        required
        autoComplete={isNew ? "new-password" : "current-password"}
        aria-describedby={[isNew && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        aria-invalid={!!error}
        ref={(input) => { if (input) validate(input); }}
        onInput={(e) => {
          const message = validate(e.currentTarget);
          if (error) setError(message);
        }}
        onBlur={(e) => setError(validate(e.currentTarget))}
        onInvalid={(e) => setError(validate(e.currentTarget))}
      />
      {isNew && <small id={`${id}-hint`} className="muted">{rule}</small>}
      {error && <small id={`${id}-error`} role="alert" className="field-error">{error}</small>}
    </div>
  );
}
