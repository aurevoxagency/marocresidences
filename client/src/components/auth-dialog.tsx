import { useEffect, useRef, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Mail, Lock, User, Phone } from "lucide-react";

import logo from "@/assets/logo.jpg";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-11 rounded-xl pl-10 pr-10"
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon: Icon,
  autoComplete,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: typeof Mail;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-11 rounded-xl pl-10"
          required
        />
      </div>
    </div>
  );
}

export function AuthDialog({ open, onOpenChange, defaultTab = "login" }: AuthDialogProps) {
  const [tab, setTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [remember, setRemember] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const scrollYRef = useRef(0);

  const resetState = () => {
    setSubmitted(false);
    setLoading(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      scrollYRef.current = window.scrollY;
    } else {
      resetState();
      const y = scrollYRef.current;
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
    onOpenChange(next);
  };

  const simulateSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 900);
  };

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    if (registerPassword !== confirmPassword) return;
    simulateSubmit(e);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto rounded-3xl border-border/70 p-0 sm:max-w-[520px]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/60 bg-muted/30 px-6 pb-5 pt-8">
          <DialogHeader className="items-center space-y-4 text-center">
            <img src={logo} alt="Maroc Résidences" className="h-11 w-auto object-contain" />
            <div className="space-y-1.5">
              <DialogTitle className="font-display text-2xl font-medium">
                {submitted ? "Bienvenue !" : "Votre espace voyageur"}
              </DialogTitle>
              <DialogDescription>
                {submitted
                  ? "Votre demande a bien été enregistrée. Nous vous contacterons très bientôt."
                  : "Connectez-vous ou créez un compte pour réserver vos séjours au Maroc."}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        {submitted ? (
          <div className="space-y-4 px-6 py-6">
            <div
              className="rounded-2xl px-4 py-3 text-center text-sm"
              style={{
                background: "color-mix(in oklab, var(--olive) 12%, white)",
                color: "var(--olive-deep)",
              }}
            >
              Merci pour votre confiance. Explorez nos destinations en attendant.
            </div>
            <Button
              className="h-11 w-full rounded-full"
              onClick={() => handleOpenChange(false)}
            >
              Continuer l'exploration
            </Button>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "login" | "register")}
            className="px-6 py-5"
          >
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-full bg-muted p-1">
              <TabsTrigger value="login" className="rounded-full text-sm">
                Se connecter
              </TabsTrigger>
              <TabsTrigger value="register" className="rounded-full text-sm">
                S'inscrire
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6 space-y-5">
              <form onSubmit={simulateSubmit} className="space-y-4">
                <Field
                  id="login-email"
                  label="Adresse e-mail"
                  type="email"
                  value={loginEmail}
                  onChange={setLoginEmail}
                  placeholder="vous@exemple.com"
                  icon={Mail}
                  autoComplete="email"
                />
                <PasswordField
                  id="login-password"
                  label="Mot de passe"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />

                <div className="flex items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      id="remember"
                      checked={remember}
                      onCheckedChange={(v) => setRemember(v === true)}
                    />
                    Se souvenir de moi
                  </label>
                  <button
                    type="button"
                    className="text-sm font-medium transition hover:underline"
                    style={{ color: "var(--terracotta)" }}
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-full text-base font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connexion…
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                  ou
                </span>
              </div>

              <Button variant="outline" type="button" className="h-11 w-full rounded-full">
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuer avec Google
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => setTab("register")}
                  className="font-medium transition hover:underline"
                  style={{ color: "var(--terracotta)" }}
                >
                  Créer un compte
                </button>
              </p>
            </TabsContent>

            <TabsContent value="register" className="mt-6 space-y-5">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id="first-name"
                    label="Prénom"
                    value={firstName}
                    onChange={setFirstName}
                    placeholder="Amina"
                    icon={User}
                    autoComplete="given-name"
                  />
                  <Field
                    id="last-name"
                    label="Nom"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Benali"
                    icon={User}
                    autoComplete="family-name"
                  />
                </div>
                <Field
                  id="register-email"
                  label="Adresse e-mail"
                  type="email"
                  value={registerEmail}
                  onChange={setRegisterEmail}
                  placeholder="vous@exemple.com"
                  icon={Mail}
                  autoComplete="email"
                />
                <Field
                  id="phone"
                  label="Téléphone"
                  type="tel"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+212 6 00 00 00 00"
                  icon={Phone}
                  autoComplete="tel"
                />
                <PasswordField
                  id="register-password"
                  label="Mot de passe"
                  value={registerPassword}
                  onChange={setRegisterPassword}
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Répétez le mot de passe"
                  autoComplete="new-password"
                />

                {confirmPassword && registerPassword !== confirmPassword && (
                  <p className="text-sm text-destructive">Les mots de passe ne correspondent pas.</p>
                )}

                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
                  <Checkbox
                    id="terms"
                    className="mt-0.5"
                    checked={acceptTerms}
                    onCheckedChange={(v) => setAcceptTerms(v === true)}
                  />
                  <span>
                    J'accepte les{" "}
                    <a href="#" className="font-medium underline-offset-2 hover:underline" style={{ color: "var(--terracotta)" }}>
                      conditions générales
                    </a>{" "}
                    et la politique de confidentialité.
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={
                    loading ||
                    !acceptTerms ||
                    (confirmPassword.length > 0 && registerPassword !== confirmPassword)
                  }
                  className="h-11 w-full rounded-full text-base font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Création du compte…
                    </>
                  ) : (
                    "Créer mon compte"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Déjà inscrit ?{" "}
                <button
                  type="button"
                  onClick={() => setTab("login")}
                  className="font-medium transition hover:underline"
                  style={{ color: "var(--terracotta)" }}
                >
                  Se connecter
                </button>
              </p>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
