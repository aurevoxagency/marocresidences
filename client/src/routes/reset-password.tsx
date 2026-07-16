import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import logo from "@/assets/header-maroc-residences-removebg-preview.png";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { resetPassword } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        required
        minLength={8}
        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!token) {
      setErrorMessage("Ce lien de réinitialisation est invalide.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const message = await resetPassword(token, password);
      setSuccessMessage(message);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible de réinitialiser le mot de passe."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[520px] overflow-hidden rounded-3xl border border-border/70 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-muted/30 px-6 pb-5 pt-8 text-center">
          <img src={logo} alt="Maroc Résidences" className="mx-auto h-12 w-auto max-w-[260px] object-contain" />
          <h1 className="mt-4 font-display text-2xl font-medium text-foreground">
            Nouveau mot de passe
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </div>

        <div className="px-6 py-6">
          {!token ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Ce lien de réinitialisation est invalide ou incomplet.
              </p>
              <Button asChild className="h-11 w-full rounded-full">
                <Link to="/">Retour à l'accueil</Link>
              </Button>
            </div>
          ) : successMessage ? (
            <div className="space-y-4 text-center">
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </p>
              <Button
                type="button"
                className="h-11 w-full rounded-full"
                onClick={() => setAuthOpen(true)}
              >
                Se connecter
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                id="new-password"
                label="Nouveau mot de passe"
                value={password}
                onChange={setPassword}
                placeholder="8 caractères minimum"
              />
              <PasswordField
                id="confirm-new-password"
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Répétez le mot de passe"
              />

              {confirmPassword && password !== confirmPassword ? (
                <p className="text-sm text-destructive">Les mots de passe ne correspondent pas.</p>
              ) : null}

              {errorMessage ? (
                <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {errorMessage}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading || password.length < 8 || password !== confirmPassword}
                className="h-11 w-full rounded-full text-base font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement…
                  </>
                ) : (
                  "Réinitialiser le mot de passe"
                )}
              </Button>
            </form>
          )}

          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </button>
        </div>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab="login" />
    </main>
  );
}
