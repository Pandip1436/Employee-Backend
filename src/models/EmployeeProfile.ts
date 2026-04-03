import mongoose, { Schema } from "mongoose";

export interface IEmployeeProfile {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  // Personal
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  profilePhoto?: string;

  // Contact
  personalEmail?: string;
  phone?: string;
  address?: string;

  // Work Info
  employeeId?: string;
  designation?: string;
  joiningDate?: string;

  // Emergency Contact
  emergencyName?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;

  // Bank Details (encrypted)
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;

  // Identity (encrypted)
  aadhaarNumber?: string;
  panNumber?: string;
  passportNumber?: string;

  // Documents
  offerLetterPath?: string;
  certificatePaths?: string[];

  // Work History
  workHistory?: {
    company: string;
    role: string;
    from: string;
    to: string;
    description?: string;
  }[];

  // Skills
  skills?: string[];
  certifications?: { name: string; issuer?: string; year?: string }[];

  createdAt: Date;
  updatedAt: Date;
}

const employeeProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },

    // Personal
    dateOfBirth: { type: String },
    gender: { type: String, enum: ["male", "female", "other", ""] },
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""] },
    profilePhoto: { type: String },

    // Contact
    personalEmail: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    // Work Info
    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true },
    joiningDate: { type: String },

    // Emergency
    emergencyName: { type: String, trim: true },
    emergencyRelation: { type: String, trim: true },
    emergencyPhone: { type: String, trim: true },

    // Bank (stored plain — mask on read)
    bankAccountNumber: { type: String, select: false },
    bankIfsc: { type: String },
    bankName: { type: String },

    // Identity (stored plain — mask on read)
    aadhaarNumber: { type: String, select: false },
    panNumber: { type: String, select: false },
    passportNumber: { type: String, select: false },

    // Documents
    offerLetterPath: { type: String },
    certificatePaths: [{ type: String }],

    // Work History
    workHistory: [{
      company: { type: String },
      role: { type: String },
      from: { type: String },
      to: { type: String },
      description: { type: String },
    }],

    // Skills & Certs
    skills: [{ type: String }],
    certifications: [{
      name: { type: String },
      issuer: { type: String },
      year: { type: String },
    }],
  },
  { timestamps: true }
);

export default mongoose.model<IEmployeeProfile>("EmployeeProfile", employeeProfileSchema);
