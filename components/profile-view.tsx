"use client";

import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { StatusBanner } from "@/components/status-banner";
import { useAuthSession } from "@/lib/auth-session";

/**
 * Renders the authenticated user's profile information.
 * 
 * @returns {JSX.Element} the rendered ProfileView component
 */
export function ProfileView() {
  const { ready, currentUser, signOut } = useAuthSession();

  if (!ready) {
    return (
      <main className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">
          <StatusBanner title="Loading" body="Pulling up your account details." tone="neutral" />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        {!currentUser ? (
          <SectionCard title="Your Profile" subtitle="Sign In Required">
            <p className="text-sm leading-7 text-slate">
              Sign in from the marketplace page to see your account details, buyer or seller role, and saved session.
            </p>
            <Link href="/" className="primary-button button-ink mt-5 inline-flex w-fit">
              Go to marketplace
            </Link>
          </SectionCard>
        ) : (
          <>
            <SectionCard title="Your Profile" subtitle="Account Details">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="glass-tile px-5 py-4">
                  <p className="section-eyebrow mb-3">Basics</p>
                  <div className="grid gap-2 text-sm text-slate">
                    <p>Name: {currentUser.displayName}</p>
                    <p>Username: {currentUser.username}</p>
                    <p>Email: {currentUser.email}</p>
                  </div>
                </div>
                <div className="glass-tile px-5 py-4">
                  <p className="section-eyebrow mb-3">Marketplace Role</p>
                  <div className="grid gap-2 text-sm text-slate">
                    <p>Account type: {currentUser.role}</p>
                    <p>Profile ID: {currentUser.profileId ?? "No marketplace profile"}</p>
                    <p>
                      {currentUser.role === "BIDDER"
                        ? "You can place bids, browse your feed, and get recommendations."
                        : currentUser.role === "AUCTIONEER"
                          ? "You can create listings and manage the selling side of the marketplace."
                          : "You have admin access."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/" className="primary-button button-tide inline-flex w-fit">
                  Back to marketplace
                </Link>
                <button type="button" className="primary-button button-ember" onClick={signOut}>
                  Sign out
                </button>
              </div>
            </SectionCard>

            <StatusBanner
              title="Account Status"
              body="Your account is active and ready to use across the marketplace."
              tone="success"
            />
          </>
        )}
      </div>
    </main>
  );
}
