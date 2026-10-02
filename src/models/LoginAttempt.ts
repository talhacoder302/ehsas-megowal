import { Schema, model, models, type Model } from "mongoose";

export const LOGIN_WINDOW_SECONDS = 15 * 60;

// One document per failed login. MongoDB deletes them after the window (TTL index),
// so no cron job is needed.
type LoginAttemptDoc = { mobile: string; createdAt: Date };

const loginAttemptSchema = new Schema<LoginAttemptDoc>(
  {
    mobile: { type: String, required: true, index: true },
    createdAt: { type: Date, required: true, default: Date.now, expires: LOGIN_WINDOW_SECONDS },
  },
  { collection: "login_attempts", versionKey: false },
);

export const LoginAttempt: Model<LoginAttemptDoc> =
  (models.LoginAttempt as Model<LoginAttemptDoc> | undefined) ??
  model<LoginAttemptDoc>("LoginAttempt", loginAttemptSchema);
