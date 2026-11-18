import { FormEvent, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner } from "@ionic/react";
import { eyeOffOutline, eyeOutline } from "ionicons/icons";
import { authErrorMessage, useAuth } from "../auth/authContext";
import {
  AuthFormValues as FormValues,
  AuthMode as Mode,
  MIN_PASSWORD_LENGTH,
  evaluatePassword,
  validateAuthForm,
} from "../auth/authForm";
import "./AuthPage.css";

const GoogleLogo: React.FC = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

const AuthPage: React.FC = () => {
  const { login, register, loginWithGoogle, googleAvailable } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [values, setValues] = useState<FormValues>({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRegister = mode === "register";
  const passwordEval = evaluatePassword(values.password);

  const update =
    (field: keyof FormValues) => (event: { target: { value: string } }) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setValues((current) => ({ ...current, password: "", confirm: "" }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateAuthForm(mode, values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy("form");
    setError(null);
    try {
      if (isRegister) {
        await register({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
        });
      } else {
        await login(values.email.trim(), values.password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setBusy("google");
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="sq-auth-content">
        <main className="sq-auth-container">
          <header className="sq-auth-brand">
            <span className="sq-auth-logo" aria-hidden="true">
              ⚔️
            </span>
            <h1>
              Stride <span>Quest</span>
            </h1>
            <p>Transformez chaque sortie en quête épique</p>
          </header>

          <section className="sq-auth-card" aria-labelledby="auth-title">
            <div
              className="sq-auth-switch"
              role="tablist"
              aria-label="Connexion ou inscription"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isRegister}
                className={!isRegister ? "is-active" : ""}
                onClick={() => switchMode("login")}
              >
                Connexion
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRegister}
                className={isRegister ? "is-active" : ""}
                onClick={() => switchMode("register")}
              >
                Inscription
              </button>
            </div>

            <h2 id="auth-title" className="sq-auth-title">
              {isRegister ? "Créer un compte" : "Se connecter"}
            </h2>

            <form
              className="sq-auth-form"
              key={mode}
              onSubmit={handleSubmit}
              noValidate
            >
              {isRegister && (
                <label className="sq-auth-field">
                  <span>Pseudo</span>
                  <input
                    name="username"
                    autoComplete="username"
                    value={values.username}
                    onChange={update("username")}
                    maxLength={40}
                    required
                  />
                </label>
              )}

              <label className="sq-auth-field">
                <span>E-mail</span>
                <input
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  value={values.email}
                  onChange={update("email")}
                  maxLength={254}
                  required
                />
              </label>

              <div className="sq-auth-field">
                <label
                  htmlFor={isRegister ? "register-password" : "login-password"}
                >
                  Mot de passe
                </label>
                <div className="sq-auth-password">
                  <input
                    key={isRegister ? "reg-pwd" : "login-pwd"}
                    id={isRegister ? "register-password" : "login-password"}
                    type={showPassword ? "text" : "password"}
                    name={isRegister ? "new-password" : "password"}
                    aria-describedby={
                      isRegister ? "auth-password-hint" : undefined
                    }
                    autoComplete={
                      isRegister ? "new-password" : "current-password"
                    }
                    value={values.password}
                    onChange={update("password")}
                    maxLength={128}
                    required
                  />
                  <button
                    type="button"
                    className="sq-auth-eye"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    <IonIcon
                      icon={showPassword ? eyeOffOutline : eyeOutline}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                {isRegister && values.password.length > 0 && (
                  <div
                    className="sq-password-strength-container"
                    aria-live="polite"
                  >
                    <div className="sq-password-meter-header">
                      <span className="sq-password-meter-title">
                        Norme de sécurité (CNIL / ANSSI)
                      </span>
                      <span
                        className={`sq-password-meter-badge sq-strength-${passwordEval.colorClass}`}
                      >
                        {passwordEval.label}
                      </span>
                    </div>
                    <div
                      className="sq-password-meter-track"
                      role="progressbar"
                      aria-valuenow={passwordEval.score}
                      aria-valuemin={0}
                      aria-valuemax={passwordEval.maxScore}
                      aria-label="Force du mot de passe"
                    >
                      <div
                        className={`sq-password-meter-fill sq-strength-${passwordEval.colorClass}`}
                        style={{
                          width: `${(passwordEval.score / passwordEval.maxScore) * 100}%`,
                        }}
                      />
                    </div>
                    <ul className="sq-password-checklist">
                      {passwordEval.criteria.map((c) => (
                        <li
                          key={c.id}
                          className={`sq-password-check-item ${c.met ? "met" : "unmet"}`}
                        >
                          <span
                            className="sq-password-check-icon"
                            aria-hidden="true"
                          >
                            {c.met ? "✓" : "○"}
                          </span>
                          <span>{c.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {isRegister && values.password.length === 0 && (
                  <small id="auth-password-hint">
                    Au moins {MIN_PASSWORD_LENGTH} caractères avec majuscule,
                    minuscule, chiffre et symbole.
                  </small>
                )}
              </div>

              {isRegister && (
                <label className="sq-auth-field">
                  <span>Confirmer le mot de passe</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirm"
                    autoComplete="new-password"
                    value={values.confirm}
                    onChange={update("confirm")}
                    maxLength={128}
                    required
                  />
                </label>
              )}

              {error && (
                <p className="sq-auth-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="sq-auth-submit"
                disabled={busy !== null}
              >
                {busy === "form" ? (
                  <IonSpinner name="crescent" aria-label="Chargement" />
                ) : isRegister ? (
                  "Créer mon compte"
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>

            <div className="sq-auth-divider" aria-hidden="true">
              <span>ou</span>
            </div>

            <div className="sq-auth-alt">
              <button
                type="button"
                className="sq-auth-google"
                onClick={handleGoogle}
                disabled={busy !== null}
                aria-label="Continuer avec Google"
                title={
                  googleAvailable
                    ? "Continuer avec Google"
                    : "Connexion Google bientôt disponible"
                }
              >
                {busy === "google" ? (
                  <IonSpinner name="crescent" aria-label="Chargement" />
                ) : (
                  <GoogleLogo />
                )}
              </button>
            </div>
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default AuthPage;
