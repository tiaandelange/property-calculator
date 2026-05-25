/** App enums — formerly from `@prisma/client`; Postgres enums live in Supabase migrations. */

export type UserRole = "USER" | "ADMIN";

export type SubscriptionStatus = "FREE" | "TRIAL" | "SUBSCRIBED";

export type RecurringExpenseMonthAnchor = "FIRST_OF_MONTH" | "LAST_OF_MONTH" | "DAY_OF_MONTH";
