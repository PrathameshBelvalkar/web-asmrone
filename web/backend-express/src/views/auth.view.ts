import type { User } from '../models/echo/common.js';
import type { LoginForm } from '../models/extension.js';
import type { Json } from '../models/json.js';
import { NO_REGISTRATION, extrasView, imageView } from './common.js';

/** FormDto list. Field `type` is the enum name ("Username", "Password", ...). */
export function loginFormsView(forms: readonly LoginForm[]): Json {
  return forms.map((form) => ({
    key: form.key,
    label: form.label,
    fields: form.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.isRequired })),
  }));
}

/** User as stored and returned. The cover is not registered for proxying. */
export function userView(user: User): Json {
  return {
    id: user.id,
    name: user.name,
    cover: imageView(user.cover, NO_REGISTRATION),
    subtitle: user.subtitle,
    extras: extrasView(user.extras),
  };
}
