import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LogIn, LogOut, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { useLogin, useLogout, useSetSetting } from '../api/mutations';
import { formsOptions, meOptions, settingsOptions } from '../api/queries';
import type { FormField, LoginForm, SettingDto } from '../api/types';
import { ErrorState, RowSkeletons } from '../components/States';
import { Button, PageHeader, Toggle } from '../components/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Separator } from '../components/ui/separator';
import { messageFor } from '../lib/errors';
import { toast } from '../lib/toast';
import { useCrumbs } from '../lib/crumbs';

export function SettingsPage() {
  useCrumbs([{ label: 'Home', to: '/' }, { label: 'Settings' }]);
  const me = useQuery(meOptions());
  const forms = useQuery({ ...formsOptions(), enabled: me.isSuccess && !me.data });
  const settings = useQuery(settingsOptions());
  const logoutMutation = useLogout();

  return (
    <>
      <PageHeader title="Settings" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound size={18} className="text-primary" aria-hidden /> Account</CardTitle>
            <CardDescription>Your asmr.one login unlocks playlists and favourites.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {me.isPending && <RowSkeletons count={2} />}
            {me.error && <ErrorState error={me.error} onRetry={() => void me.refetch()} />}
            {me.data && (
              <div className="flex items-center gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
                  {me.data.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{me.data.name}</div>
                  <div className="text-sm text-muted-foreground">Signed in to asmr.one</div>
                </div>
                <Button
                  variant="secondary"
                  icon={LogOut}
                  onClick={async () => {
                    try {
                      await logoutMutation.mutateAsync();
                      toast('Logged out');
                    } catch (e) {
                      toast(messageFor(e));
                    }
                  }}
                >
                  Log out
                </Button>
              </div>
            )}
            {me.isSuccess && !me.data && forms.data?.[0] && <LoginFormView form={forms.data[0]} />}
            {forms.error && <ErrorState error={forms.error} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-primary" aria-hidden /> Preferences</CardTitle>
            <CardDescription>Changes apply straight away.</CardDescription>
          </CardHeader>
          <CardContent>
            {settings.isPending && <RowSkeletons count={4} />}
            {settings.error && <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />}
            <div className="divide-y">
              {settings.data?.map((s) => (
                <SettingRow key={s.key} setting={s} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function LoginFormView({ form }: { form: LoginForm }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const loginMutation = useLogin();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await loginMutation.mutateAsync({ key: form.key, data: values });
      toast(`Logged in as ${user.name}`);
      setValues({});
    } catch (err) {
      toast(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {form.fields.map((field: FormField) => (
        <div key={field.key} className="grid gap-2">
          <Label htmlFor={`login-${field.key}`}>{field.label}</Label>
          <Input
            id={`login-${field.key}`}
            type={field.type === 'Password' ? 'password' : 'text'}
            required={field.required}
            autoComplete={field.type === 'Password' ? 'current-password' : 'username'}
            value={values[field.key] ?? ''}
            onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Your password goes only to asmr.one.</p>
      <Button type="submit" variant="primary" icon={LogIn} disabled={busy} className="w-full sm:w-auto">
        {busy ? 'Logging in' : 'Log in'}
      </Button>
    </form>
  );
}

function SettingRow({ setting }: { setting: SettingDto }) {
  const [saving, setSaving] = useState(false);
  const setSetting = useSetSetting();
  const save = async (value: unknown) => {
    setSaving(true);
    try {
      await setSetting.mutateAsync({ key: setting.key, value });
    } catch (e) {
      toast(messageFor(e));
    } finally {
      setSaving(false);
    }
  };

  if (setting.kind === 'category') {
    return (
      <div className="py-5 first:pt-0 last:pb-0">
        <div className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{setting.title}</div>
        <div className="space-y-5">
          {setting.children?.map((child) => <SettingRow key={child.key} setting={child} />)}
        </div>
      </div>
    );
  }

  const row = 'flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0';
  const label = (
    <div className="min-w-0">
      <div className="text-sm">{setting.title}</div>
      {setting.summary && <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{setting.summary}</div>}
    </div>
  );

  switch (setting.kind) {
    case 'switch':
      return (
        <div className={row}>
          {label}
          <Toggle label={setting.title} checked={Boolean(setting.value)} disabled={saving} onChange={(next) => save(next)} />
        </div>
      );
    case 'list':
      return (
        <div className={row}>
          {label}
          <Select value={String(setting.value ?? '')} onValueChange={(v) => save(v)} disabled={saving}>
            <SelectTrigger aria-label={setting.title} className="w-auto min-w-40 max-w-[55%] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      );
    case 'multi':
      return <MultiChoice setting={setting} saving={saving} onSave={save} label={label} />;
    case 'slider': {
      const min = setting.min ?? 0;
      const max = setting.max ?? 100;
      return (
        <div className={row}>
          {label}
          <Slider
            min={min}
            max={max}
            step={1}
            disabled={saving}
            value={[Number(setting.value ?? min)]}
            onValueCommit={([v]) => save(v)}
            className="w-40"
          />
        </div>
      );
    }
    case 'text':
      return (
        <div className={row}>
          {label}
          <Input
            aria-label={setting.title}
            defaultValue={String(setting.value ?? '')}
            onBlur={(e) => {
              if (e.target.value !== String(setting.value ?? '')) void save(e.target.value);
            }}
            className="w-48"
          />
        </div>
      );
    default:
      return <div className="py-4 first:pt-0 last:pb-0">{label}</div>;
  }
}

/** Tag picker. With many options it gets a filter box. Selected options are listed first. */
function MultiChoice({
  setting, saving, onSave, label,
}: {
  setting: SettingDto;
  saving: boolean;
  onSave: (value: string[]) => void;
  label: React.ReactNode;
}) {
  const [filter, setFilter] = useState('');
  const selected = useMemo(() => new Set(Array.isArray(setting.value) ? (setting.value as string[]) : []), [setting.value]);
  const options = setting.options ?? [];
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? options.filter((o) => o.title.toLowerCase().includes(q)) : options;
    return [...list.filter((o) => selected.has(o.value)), ...list.filter((o) => !selected.has(o.value))].slice(0, 120);
  }, [filter, options, selected]);

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-end justify-between gap-4">
        {label}
        <Badge variant="secondary" className="shrink-0 tnum">{selected.size} selected</Badge>
      </div>
      {options.length > 16 && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tags" aria-label={`Filter ${setting.title}`} className="pl-9" />
        </div>
      )}
      <Separator />
      <div className="scroll-thin flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
        {visible.map((o) => {
          const on = selected.has(o.value);
          return (
            <Badge
              key={o.value}
              asChild
              variant={on ? 'default' : 'outline'}
              className="cursor-pointer rounded-full font-normal"
            >
              <button
                type="button"
                aria-pressed={on}
                disabled={saving}
                onClick={() => {
                  const next = new Set(selected);
                  if (on) next.delete(o.value);
                  else next.add(o.value);
                  onSave([...next]);
                }}
              >
                {o.title}
              </button>
            </Badge>
          );
        })}
      </div>
      {options.length > 120 && !filter && <p className="text-xs text-muted-foreground">Showing the selected tags and the first 120. Use the filter to find others.</p>}
    </div>
  );
}
