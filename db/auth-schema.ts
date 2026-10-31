import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    phoneNumber: text("phone_number").unique(),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    image: text("image"),
    status: text("status").notNull().default("active"),
    locale: text("locale").notNull().default("fa"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: instant("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("user_sessions_token_unique").on(table.token),
    index("user_sessions_user_idx").on(table.userId),
  ],
);

export const userAccounts = pgTable(
  "user_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [index("user_accounts_user_idx").on(table.userId)],
);

export const userVerifications = pgTable(
  "user_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").defaultNow(),
    updatedAt: instant("updated_at").defaultNow(),
  },
  (table) => [index("user_verifications_identifier_idx").on(table.identifier)],
);

export const platformAdmins = pgTable(
  "platform_admins",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    status: text("status").notNull().default("active"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("platform_admins_email_lower_unique").on(sql`lower(${table.email})`)],
);

export const platformAdminSessions = pgTable(
  "platform_admin_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: instant("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("platform_admin_sessions_token_unique").on(table.token),
    index("platform_admin_sessions_user_idx").on(table.userId),
  ],
);

export const platformAdminAccounts = pgTable(
  "platform_admin_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [index("platform_admin_accounts_user_idx").on(table.userId)],
);

export const platformAdminVerifications = pgTable(
  "platform_admin_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").defaultNow(),
    updatedAt: instant("updated_at").defaultNow(),
  },
  (table) => [index("platform_admin_verifications_identifier_idx").on(table.identifier)],
);

export const platformAdminTwoFactors = pgTable(
  "platform_admin_two_factors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(false),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: instant("locked_until"),
  },
  (table) => [uniqueIndex("platform_admin_two_factors_user_unique").on(table.userId)],
);
