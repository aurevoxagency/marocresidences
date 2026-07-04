import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiBaseUrl, saveAuthToken, type AuthUser } from "@/lib/auth";

function logClientAuth(scope: string, data?: unknown) {
  console.log(`[CLIENT AUTH] ${scope}`, data ?? "");
}

function logClientAuthError(scope: string, error: unknown) {
  console.error(`[CLIENT AUTH ERROR] ${scope}`, error);
}

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
};

type AuthResponse = {
  message?: string;
  token?: string;
  user?: AuthUser;
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
  const navigate = useNavigate();
  const [tab, setTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
    setLoading(false);
    setErrorMessage("");
    setSuccessMessage("");
  };

  useEffect(() => {
    if (open) {
      setTab(defaultTab);
      setErrorMessage("");
      setSuccessMessage("");
    }
  }, [defaultTab, open]);

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

  const handleAuthSuccess = async (token: string) => {
    logClientAuth("Login success, redirecting to dashboard");
    saveAuthToken(token, remember);
    resetState();
    onOpenChange(false);
    await navigate({ to: "/dashboard" });
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    const loginUrl = `${getApiBaseUrl()}/users/login`;
    const loginPayload = {
      email: loginEmail,
      password: loginPassword,
    };

    logClientAuth("Login request", {
      url: loginUrl,
      email: loginEmail,
    });

    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginPayload),
      });

      const data = (await response.json().catch((error) => {
        logClientAuthError("Failed to parse login response", error);
        return {};
      })) as AuthResponse;

      logClientAuth("Login response", {
        status: response.status,
        ok: response.ok,
        message: data.message,
        hasToken: Boolean(data.token),
        user: data.user,
        role_id: data.user?.role_id,
      });

      if (!response.ok || !data.token) {
        throw new Error(data.message || "Connexion impossible.");
      }

      await handleAuthSuccess(data.token);
    } catch (error) {
      logClientAuthError("Login failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (registerPassword !== confirmPassword) return;
    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    const registerUrl = `${getApiBaseUrl()}/users/register`;
    const registerPayload = {
      first_name: firstName,
      last_name: lastName,
      email: registerEmail,
      phone,
      password: registerPassword,
      terms_accepted: acceptTerms,
    };

    logClientAuth("Register request", {
      url: registerUrl,
      payload: registerPayload,
    });

    try {
      const registerResponse = await fetch(registerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerPayload),
      });

      const registerData = (await registerResponse.json().catch((error) => {
        logClientAuthError("Failed to parse register response", error);
        return {};
      })) as AuthResponse;

      logClientAuth("Register response", {
        status: registerResponse.status,
        ok: registerResponse.ok,
        message: registerData.message,
        user: registerData.user,
        role_id: registerData.user?.role_id,
      });

      if (!registerResponse.ok) {
        throw new Error(registerData.message || "Inscription impossible.");
      }
      setLoginEmail(registerEmail);
      setLoginPassword("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setRegisterEmail("");
      setRegisterPassword("");
      setConfirmPassword("");
      setAcceptTerms(false);
      setTab("login");
      setSuccessMessage("Compte cree avec succes. Connectez-vous maintenant.");
      logClientAuth("Register success, switched to login tab");
    } catch (error) {
      logClientAuthError("Register failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
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
                Votre espace voyageur
              </DialogTitle>
              <DialogDescription>
                Connectez-vous ou créez un compte pour réserver vos séjours au Maroc.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "login" | "register");
            setErrorMessage("");
            setSuccessMessage("");
          }}
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
              <form onSubmit={handleLogin} className="space-y-4">
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
                {successMessage ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {successMessage}
                  </p>
                ) : null}
                {errorMessage ? (
                  <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
              </form>

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
                {errorMessage ? (
                  <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
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
      </DialogContent>
    </Dialog>
  );
}
