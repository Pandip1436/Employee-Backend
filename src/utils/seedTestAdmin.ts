import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User";

dotenv.config();

// Test admin credentials — override with env vars when seeding a shared environment.
const TEST_ADMIN = {
  name: process.env.TEST_ADMIN_NAME || "Test Admin",
  email: (process.env.TEST_ADMIN_EMAIL || "testadmin@company.com").toLowerCase(),
  userId: (process.env.TEST_ADMIN_USERID || "testadmin").toLowerCase(),
  password: process.env.TEST_ADMIN_PASSWORD || "Test@12345",
  role: "admin",
  department: "Administration",
};

// Create the test admin, or reset its password/role if it already exists.
async function seedTestAdmin(): Promise<void> {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);

  const existing = await User.findOne({
    $or: [{ userId: TEST_ADMIN.userId }, { email: TEST_ADMIN.email }],
  }).select("+password");

  if (existing) {
    existing.name = TEST_ADMIN.name;
    existing.email = TEST_ADMIN.email;
    existing.userId = TEST_ADMIN.userId;
    existing.password = TEST_ADMIN.password; // re-hashed by the pre-save hook
    existing.role = "admin";
    existing.isActive = true;
    existing.inactiveReason = "";
    existing.relievingDate = "";
    existing.activeToken = undefined;
    await existing.save();
    console.log("[seed] Existing test admin updated and password reset.");
  } else {
    await User.create(TEST_ADMIN);
    console.log("[seed] Test admin created.");
  }

  console.log("--------------------------------");
  console.log(`  User ID  : ${TEST_ADMIN.userId}`);
  console.log(`  Password : ${TEST_ADMIN.password}`);
  console.log(`  Email    : ${TEST_ADMIN.email}`);
  console.log(`  Role     : admin`);
  console.log("--------------------------------");

  await mongoose.disconnect();
}

seedTestAdmin().catch((err) => {
  console.error(`[seed] Failed: ${(err as Error).message}`);
  process.exit(1);
});
