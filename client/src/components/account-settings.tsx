import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthUser } from "@/lib/auth";
import { getRoleLabel } from "@/lib/roles";
import { updateCurrentUser } from "@/lib/users";

type AccountSettingsProps = {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
};

export function AccountSettings({ user, onUserUpdated }: AccountSettingsProps) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email);
    setPhone(user.phone || "");
    setPassword("");
    setShowPassword(false);
    setError(null);
    setSuccess(null);
  }, [user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      ...(password ? { password } : {}),
    };

    if (!payload.first_name || !payload.last_name || !payload.email) {
      setError("Prénom, nom et email sont obligatoires.");
      setSaving(false);
      return;
    }

    try {
      const updatedUser = await updateCurrentUser(payload);
      onUserUpdated(updatedUser);
      setPassword("");
      setSuccess("Vos informations ont été mises à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le profil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-slate-900">
          Paramètres du compte
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Consultez et modifiez vos informations personnelles.
        </p>
      </div>

      <div className="mt-6 rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-6 grid gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-[13px] sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Rôle</p>
            <p className="mt-1 font-medium text-slate-800">{getRoleLabel(user.role_id)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Membre depuis
            </p>
            <p className="mt-1 font-medium text-slate-800">
              {user.created_at
                ? new Date(user.created_at).toLocaleDateString("fr-FR")
                : "—"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="account-first-name">Prénom</Label>
              <Input
                id="account-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-last-name">Nom</Label>
              <Input
                id="account-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-phone">Téléphone</Label>
            <Input
              id="account-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-password">
              Nouveau mot de passe (laisser vide pour ne pas changer)
            </Label>
            <div className="relative">
              <Input
                id="account-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-[13px] text-red-600">{error}</p>}
          {success && <p className="text-[13px] text-emerald-600">{success}</p>}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} className="rounded-xl">
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
