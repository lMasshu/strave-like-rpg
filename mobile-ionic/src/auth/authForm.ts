export type AuthMode = "login" | "register";

export interface AuthFormValues {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

/** Mêmes règles que l'API (qui revalide tout côté serveur). */
export const MIN_PASSWORD_LENGTH = 8;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Renvoie le premier problème du formulaire, ou `null` s'il est valide. */
export function validateAuthForm(
  mode: AuthMode,
  values: AuthFormValues,
): string | null {
  if (mode === "register" && !USERNAME_RE.test(values.username.trim())) {
    return "Le pseudo doit faire 3 à 40 caractères : lettres, chiffres, _ . -";
  }
  if (!EMAIL_RE.test(values.email.trim())) return "Saisissez un e-mail valide.";
  if (mode === "login") {
    return values.password ? null : "Saisissez votre mot de passe.";
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (values.password.trim().length === 0) {
    return "Le mot de passe ne peut pas être vide.";
  }
  if (values.password !== values.confirm) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
