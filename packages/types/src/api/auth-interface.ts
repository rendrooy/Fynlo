export interface AuthUserInterface {
  email: string;
  id: string;
  initials: string;
  name: string;
}

export interface LoginResponseInterface {
  token: string;
  user: AuthUserInterface;
}
