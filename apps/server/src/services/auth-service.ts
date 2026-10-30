import { pool } from "../connection/db";
import { HttpError } from "../utils/http-error";
import { signToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

interface UserRow {
  email: string;
  id: string;
  initials: string;
  name: string;
  password_hash: string;
}

const toProfile = ({ email, id, initials, name }: UserRow) => ({
  email,
  id,
  initials,
  name,
});

// Verified against when the email is unknown, so both cases take the same time.
const dummyHash = hashPassword("fynlo-timing-placeholder");

export async function getProfile(userId: string) {
  const { rows } = await pool.query<UserRow>(
    "SELECT id, email, name, initials, password_hash FROM m_user WHERE id = $1",
    [userId],
  );
  const user = rows[0];
  if (!user) throw new HttpError(401, "Unauthorized");
  return toProfile(user);
}

export async function login(email: string, password: string) {
  const { rows } = await pool.query<UserRow>(
    "SELECT id, email, name, initials, password_hash FROM m_user WHERE email = $1",
    [email.trim().toLowerCase()],
  );
  const user = rows[0];
  const valid = await verifyPassword(
    password,
    user?.password_hash ?? (await dummyHash),
  );
  if (!user || !valid) throw new HttpError(401, "Invalid email or password");
  return { token: signToken(user.id), user: toProfile(user) };
}
