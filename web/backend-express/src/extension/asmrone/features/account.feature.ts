import type { EchoMediaItem } from '../../../models/echo/media.js';
import type { User } from '../../../models/echo/common.js';
import type { LoginForm } from '../../../models/extension.js';
import { parseKotlinBoolean } from '../util/text.js';
import type { ExtensionContext } from './context.js';

const LOGIN_FORM: LoginForm = {
  key: 'login',
  label: 'Login',
  fields: [
    { key: 'username', label: 'Username', type: 'Username', isRequired: true },
    { key: 'password', label: 'Password', type: 'Password', isRequired: true },
  ],
};

/** Login, likes and sharing. The logged-in user is held here and pushed to the API client. */
export class AccountFeature {
  private user: User | null = null;

  constructor(private readonly ctx: ExtensionContext) {}

  readonly loginForms: readonly LoginForm[] = [LOGIN_FORM];

  async onLogin(_key: string, data: Readonly<Record<string, string | null>>): Promise<User[]> {
    const username = data.username;
    const password = data.password;
    if (username === null || username === undefined || password === null || password === undefined) {
      return [];
    }
    const result = await this.ctx.api.login(username, password);
    return [
      {
        id: result.recommenderUuid,
        name: result.name,
        cover: null,
        subtitle: null,
        extras: { token: result.token },
      },
    ];
  }

  setLoginUser(user: User | null): void {
    this.user = user;
    this.ctx.api.updateUser(user?.id ?? null, user?.extras.token ?? null);
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  async likeItem(item: EchoMediaItem, shouldLike: boolean): Promise<void> {
    const id = likeTargetId(item);
    const numeric = Number(id);
    if (!Number.isInteger(numeric)) throw new Error('Expected album id');
    if (shouldLike) {
      this.ctx.pendingLikes.set(numeric, 'LIKE');
      await this.ctx.api.rateWork(id, 5);
    } else {
      this.ctx.pendingLikes.set(numeric, 'UNLIKE');
      await this.ctx.api.deleteRating(id);
    }
  }

  isItemLiked(item: EchoMediaItem): boolean {
    const value = item.extras.isLiked;
    return value === undefined ? false : parseKotlinBoolean(value);
  }

  onShare(item: EchoMediaItem): string {
    if (item.kind === 'Album') return `https://asmr.one/work/RJ${item.id}`;
    const id = item.extras.id;
    if (id === undefined) return 'https://asmr.one';
    return `https://asmr.one/work/RJ${id}`;
  }
}

function likeTargetId(item: EchoMediaItem): string {
  switch (item.kind) {
    case 'Track': {
      const id = item.album?.id ?? item.extras.id;
      if (id === undefined) throw new Error('Expected album id');
      return id;
    }
    case 'Album':
      return item.id;
    default:
      throw new Error('Expected album id');
  }
}
