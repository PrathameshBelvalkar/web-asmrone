import type { Request, Response } from 'express';
import { userView } from '../views/auth.view.js';
import { loginFormsView } from '../views/auth.view.js';
import { optionalString, primitiveMap } from '../schemas/body.js';
import type { AuthService } from '../services/auth.service.js';

/** Login, logout and the current user. */
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  forms = (_req: Request, res: Response): void => {
    res.json(loginFormsView(this.auth.forms));
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = req.jsonBody;
    const user = await this.auth.login(optionalString(body, 'key') ?? 'login', primitiveMap(body.data));
    res.json(userView(user));
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    await this.auth.logout();
    res.status(204).end();
  };

  me = async (_req: Request, res: Response): Promise<void> => {
    const user = await this.auth.me();
    res.json(user === null ? null : userView(user));
  };
}
