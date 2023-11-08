// import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getServerSession, type DefaultSession, type NextAuthOptions } from "next-auth";

import { env } from "~/env.mjs";
// import { db } from "~/server/db";
// import { mysqlTable } from "~/server/db/schema";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "./db";
import bcrypt from "bcrypt";
import { sql } from "drizzle-orm";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
    interface Session extends DefaultSession {
        user: {
            id: string;
            // ...other properties
            role: string;
        } & DefaultSession["user"];
    }

    interface User {
        // ...other properties
        role: string;
    }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
    secret: env.NEXTAUTH_SECRET,
    callbacks: {
        session({ session, token }) {
            session.user.id = token.id as string;
            session.user.role = token.role as string;

            return session;
        },
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
            }
            return token;
        },
    },
    // adapter: DrizzleAdapter(db, mysqlTable),
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/auth/signin",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",

            credentials: {
                username: { label: "Username", type: "text", placeholder: "jsmith" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, req) {
                const user = await db.query.users.findFirst({
                    where: sql`email=${credentials?.username}`,
                });

                const password = user?.password ?? "";
                const isUser = await bcrypt.compare(
                    credentials?.password ?? "",
                    password
                );

                if (isUser) {
                    return {
                        id: user?.id ?? "",
                        name: user?.name ?? "",
                        email: user?.email ?? "",
                        role: user?.role ?? "",
                    };
                }

                return null;
            },
        }),

        /**
         * ...add more providers here.
         *
         * Most other providers require a bit more work than the Discord provider. For example, the
         * GitHub provider requires you to add the `refresh_token_expires_in` field to the Account
         * model. Refer to the NextAuth.js docs for the provider you want to use. Example:
         *
         * @see https://next-auth.js.org/providers/github
         */
    ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
