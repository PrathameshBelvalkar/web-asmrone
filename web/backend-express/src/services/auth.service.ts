import type { User } from '../models/echo/common.js';
import type { LoginForm, MusicExtension } from '../models/extension.js';
import { HttpError } from '../models/errors.js';
import type { UserRepository } from '../repositories/user.repository.js';
import { parseImage } from '../schemas/media-item.schema.js';

/** Login state: the one saved user, pushed into the extension (and its API client). */
export class AuthService {
  constructor(
    private readonly ext: MusicExtension,
    private readonly users: UserRepository,
  ) {}

  get forms(): readonly LoginForm[] {
    return this.ext.loginForms;
  }

  async login(key: string, data: Readonly<Record<string, string | null>>): Promise<User> {
    const users = await this.ext.onLogin(key, data);
    const user = users[0];
    if (user === undefined) throw HttpError.badRequest('Login returned no user');
    // Stored in the same layout as the Kotlin server. The cover is never set on login, so it is null.
    await this.users.save({ id: user.id, name: user.name, cover: null, subtitle: user.subtitle, extras: user.extras });
    this.ext.setLoginUser(user);
    return user;
  }

  async logout(): Promise<void> {
    await this.users.clear();
    this.ext.setLoginUser(null);
  }

  me(): Promise<User | null> {
    return this.ext.getCurrentUser();
  }

  /** Called when asmr.one rejects the session. Forgets the saved login. */
  async expireSession(): Promise<void> {
    await this.users.clear();
    this.ext.setLoginUser(null);
  }

  /** Startup: restore the saved login into the extension. */
  async restore(): Promise<void> {
    const stored = await this.users.load();
    if (stored === null) return;
    const cover = safeImage(stored.cover);
    this.ext.setLoginUser({
      id: stored.id,
      name: stored.name,
      cover,
      subtitle: stored.subtitle ?? null,
      extras: stored.extras,
    });
  }
}

function safeImage(value: unknown): User['cover'] {
  if (value === null || value === undefined) return null;
  try {
    return parseImage(value);
  } catch {
    return null;
  }
}
