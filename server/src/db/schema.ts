import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().defaultRandom(),
        email: text("email").notNull(),
        passwordHash: text("password_hash").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [uniqueIndex("users_email_unique_idx").on(table.email)]
);

export const documents = pgTable(
    "documents",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        content: text("content").notNull().default(""),

        creatorId: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),

        expiresAt: timestamp("expires_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        index("documents_creator_id_idx").on(table.creatorId),
        index("documents_expires_at_idx").on(table.expiresAt),
    ]
);

export type Document = typeof documents.$inferSelect;
