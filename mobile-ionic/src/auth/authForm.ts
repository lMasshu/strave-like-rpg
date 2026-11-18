export type AuthMode = "login" | "register";

export interface AuthFormValues {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

/** Norme de sécurité moderne (CNIL / ANSSI) : 12 caractères et 4 jeux de caractères. */
export const MIN_PASSWORD_LENGTH = 12;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,40}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordCriterion {
  id: "length" | "uppercase" | "lowercase" | "number" | "special";
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  score: number;
  maxScore: number;
  label: "Très faible" | "Moyen" | "Solide" | "Conforme";
  colorClass: "weak" | "fair" | "good" | "strong";
  criteria: PasswordCriterion[];
  isValid: boolean;
}

/** Évalue la force du mot de passe selon les critères de sécurité de référence. */
export function evaluatePassword(password: string): PasswordEvaluation {
  const criteria: PasswordCriterion[] = [
    {
      id: "length",
      label: `Au moins ${MIN_PASSWORD_LENGTH} caractères`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "uppercase",
      label: "Une lettre majuscule (A-Z)",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "Une lettre minuscule (a-z)",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "Un chiffre (0-9)",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "Un caractère spécial (!, @, #, $, etc.)",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const score = criteria.filter((c) => c.met).length;

  let label: PasswordEvaluation["label"] = "Très faible";
  let colorClass: PasswordEvaluation["colorClass"] = "weak";

  if (score >= 5) {
    label = "Conforme";
    colorClass = "strong";
  } else if (score >= 4) {
    label = "Solide";
    colorClass = "good";
  } else if (score >= 2) {
    label = "Moyen";
    colorClass = "fair";
  }

  return {
    score,
    maxScore: criteria.length,
    label,
    colorClass,
    criteria,
    isValid: score === criteria.length,
  };
}

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
  if (values.password.trim().length === 0) {
    return "Le mot de passe ne peut pas être vide.";
  }
  const evalResult = evaluatePassword(values.password);
  if (!evalResult.isValid) {
    if (values.password.length < MIN_PASSWORD_LENGTH) {
      return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    }
    const missing = evalResult.criteria
      .filter((c) => !c.met)
      .map((c) => c.label.toLowerCase());
    return `Le mot de passe doit respecter les normes : ${missing.join(", ")}.`;
  }
  if (values.password !== values.confirm) {
    return "Les deux mots de passe ne correspondent pas.";
  }
  return null;
}
