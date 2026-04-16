import User from "../models/User";

// Derive a userId candidate from an email: "jane.doe@acme.com" → "jane.doe"
const seedFromEmail = (email: string): string =>
  (email.split("@")[0] || "user").toLowerCase().trim().replace(/[^a-z0-9._-]/g, "");

// Assign a userId to every user who doesn't have one, resolving collisions with a numeric suffix.
export async function backfillUserIds(): Promise<void> {
  const users = await User.find({ $or: [{ userId: { $exists: false } }, { userId: null }, { userId: "" }] }).select("email userId");
  if (!users.length) return;

  const taken = new Set<string>(
    (await User.find({ userId: { $exists: true, $ne: null } }).select("userId"))
      .map((u: any) => String(u.userId || "").toLowerCase())
      .filter(Boolean)
  );

  for (const u of users) {
    const base = seedFromEmail(u.email) || `user${String(u._id).slice(-4)}`;
    let candidate = base;
    let n = 1;
    while (taken.has(candidate)) {
      n += 1;
      candidate = `${base}${n}`;
    }
    taken.add(candidate);
    await User.updateOne({ _id: u._id }, { $set: { userId: candidate } });
  }

  console.log(`[backfill] Assigned userId to ${users.length} user(s).`);
}
